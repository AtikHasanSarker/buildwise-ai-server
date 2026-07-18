import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Product, { ProductCategory } from "../models/Product";
import AIConversation from "../models/AIConversation";
import RateLimit from "../models/RateLimit";
import { sendSuccess, sendError } from "../utils/response";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

const VALID_PURPOSES = ["gaming", "programming", "editing", "office"] as const;
type Purpose = (typeof VALID_PURPOSES)[number];

const REQUIRED_CATEGORIES: ProductCategory[] = [
  "CPU",
  "GPU",
  "Motherboard",
  "RAM",
  "SSD",
  "PSU",
  "Case",
];

// Budget allocation by purpose (approximate percentage per category)
const BUDGET_WEIGHTS: Record<Purpose, Partial<Record<ProductCategory, number>>> = {
  gaming: {
    CPU: 0.15,
    GPU: 0.38,
    Motherboard: 0.08,
    RAM: 0.10,
    SSD: 0.08,
    PSU: 0.08,
    Case: 0.06,
    Cooler: 0.07,
  },
  programming: {
    CPU: 0.30,
    GPU: 0.05,
    Motherboard: 0.10,
    RAM: 0.20,
    SSD: 0.15,
    PSU: 0.08,
    Case: 0.05,
    Cooler: 0.07,
  },
  editing: {
    CPU: 0.25,
    GPU: 0.25,
    Motherboard: 0.08,
    RAM: 0.15,
    SSD: 0.12,
    PSU: 0.06,
    Case: 0.04,
    Cooler: 0.05,
  },
  office: {
    CPU: 0.25,
    GPU: 0.05,
    Motherboard: 0.12,
    RAM: 0.15,
    SSD: 0.20,
    PSU: 0.10,
    Case: 0.08,
    Cooler: 0.05,
  },
};

const getTodayKey = (): string => {
  return new Date().toISOString().split("T")[0];
};

const checkRateLimit = async (identifier: string, limit: number): Promise<{ allowed: boolean; count: number }> => {
  const today = getTodayKey();
  const record = await RateLimit.findOne({ identifier, date: today });

  if (!record) {
    await RateLimit.create({ identifier, date: today, count: 1 });
    return { allowed: true, count: 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, count: record.count };
  }

  record.count += 1;
  await record.save();
  return { allowed: true, count: record.count };
};

const buildPrompt = (candidates: Record<string, unknown[]>, purpose: string): string => {
  return `You are an expert PC builder. Given the following candidates per category, select ONE product per category to build a ${purpose} PC.

IMPORTANT RULES:
- You MUST choose only from the product IDs listed below. NEVER invent or guess a product ID.
- Return ONLY valid JSON, no markdown, no code fences, no extra text.
- Every required category (CPU, GPU, Motherboard, RAM, SSD, PSU, Case) must have exactly one pick. Cooler is optional.
- Stay as close to the total budget as possible without going over.

JSON format required:
{
  "components": [
    { "category": "CPU", "productId": "...", "reasoning": "1-2 sentence reason" }
  ],
  "overallReasoning": "Brief overall build strategy explanation"
}

CANDIDATES:
${JSON.stringify(candidates, null, 2)}`;
};

const parseGeminiResponse = (text: string): { components: { category: string; productId: string; reasoning: string }[]; overallReasoning: string } | null => {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.components && Array.isArray(parsed.components) && parsed.overallReasoning) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

// POST /api/v1/ai/generate-build
router.post("/generate-build", async (req: Request, res: Response) => {
  try {
    // Step 1: Validate input
    const { budget, purpose, preferredBrand } = req.body;

    if (!budget || typeof budget !== "number" || budget <= 0) {
      return sendError(res, "Budget must be a positive number", 400, "VALIDATION_ERROR", "budget: must be > 0");
    }
    if (!purpose || !VALID_PURPOSES.includes(purpose as Purpose)) {
      return sendError(
        res,
        `Purpose must be one of: ${VALID_PURPOSES.join(", ")}`,
        400,
        "VALIDATION_ERROR",
        `purpose: must be ${VALID_PURPOSES.join(" | ")}`
      );
    }

    // Step 2: Rate limiting
    const isAuth = !!req.user;
    const identifier = isAuth ? `user:${req.user!._id}` : `ip:${req.ip}`;
    const dailyLimit = isAuth ? 50 : 5;

    const rateCheck = await checkRateLimit(identifier, dailyLimit);
    if (!rateCheck.allowed) {
      return sendError(
        res,
        `Daily AI request limit reached (${dailyLimit}/day)`,
        429,
        "RATE_LIMITED",
        `Used ${rateCheck.count}/${dailyLimit} requests today`
      );
    }

    // Step 3: Query candidate products per category
    const purposeKey = purpose as Purpose;
    const weights = BUDGET_WEIGHTS[purposeKey];
    const categories: ProductCategory[] = [...REQUIRED_CATEGORIES];

    // Include Cooler if budget allows (>= $500)
    if (budget >= 500) categories.push("Cooler");

    const candidatesByCategory: Record<string, unknown[]> = {};
    const allCandidateIds: string[] = [];

    for (const category of categories) {
      const weight = weights[category] || 0.05;
      const categoryBudget = budget * weight;
      const minPrice = categoryBudget * 0.3;
      const maxPrice = categoryBudget * 1.8;

      const query: Record<string, unknown> = {
        category,
        stock: { $gt: 0 },
        price: { $gte: minPrice, $lte: maxPrice },
      };
      if (preferredBrand) {
        query.brand = preferredBrand;
      }

      const products = await Product.find(query)
        .select("name brand price category specifications rating")
        .sort({ rating: -1, price: 1 })
        .limit(5)
        .lean();

      candidatesByCategory[category] = products.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        brand: p.brand,
        price: p.price,
        specs: p.specifications,
        rating: p.rating,
      }));

      allCandidateIds.push(...products.map((p) => p._id.toString()));
    }

    if (allCandidateIds.length === 0) {
      return sendError(
        res,
        "No suitable products found for this budget and preferences",
        404,
        "NOT_FOUND",
        "Try adjusting budget or removing brand filter"
      );
    }

    // Step 4: Call Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return sendError(res, "AI service not configured", 500, "AI_ERROR", "GEMINI_API_KEY not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = buildPrompt(candidatesByCategory, purpose);
    let result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // Step 5: Parse response
    let parsed = parseGeminiResponse(responseText);

    // Retry once with stricter prompt if parse failed
    if (!parsed) {
      const strictPrompt = prompt + "\n\nREMINDER: Output ONLY valid JSON. No markdown, no code fences, no explanations outside the JSON.";
      result = await model.generateContent(strictPrompt);
      responseText = result.response.text();
      parsed = parseGeminiResponse(responseText);
    }

    if (!parsed) {
      return sendError(res, "Failed to parse AI response", 502, "AI_ERROR", "Gemini returned invalid JSON");
    }

    // Step 6: Validate every productId exists and is in stock
    const pickedIds = parsed.components.map((c) => c.productId);
    const verifiedProducts = await Product.find({
      _id: { $in: pickedIds },
      stock: { $gt: 0 },
    }).lean();

    const verifiedMap = new Map(verifiedProducts.map((p) => [p._id.toString(), p]));

    const verifiedComponents: {
      category: string;
      productId: string;
      reasoning: string;
      product: typeof verifiedProducts[number];
    }[] = [];

    const verifiedCategories = new Set<string>();

    for (const comp of parsed.components) {
      if (verifiedMap.has(comp.productId) && !verifiedCategories.has(comp.category)) {
        verifiedComponents.push({
          category: comp.category,
          productId: comp.productId,
          reasoning: comp.reasoning,
          product: verifiedMap.get(comp.productId)!,
        });
        verifiedCategories.add(comp.category);
      }
    }

    // Fill in any missing required categories with best available from candidates
    for (const category of REQUIRED_CATEGORIES) {
      if (!verifiedCategories.has(category)) {
        const fallbackProducts = candidatesByCategory[category] as { id: string }[] | undefined;
        if (fallbackProducts && fallbackProducts.length > 0) {
          const fallbackId = fallbackProducts[0].id;
          if (verifiedMap.has(fallbackId)) {
            const product = verifiedMap.get(fallbackId)!;
            verifiedComponents.push({
              category,
              productId: fallbackId,
              reasoning: "Selected as fallback after AI pick was invalid",
              product,
            });
            verifiedCategories.add(category);
          }
        }
      }
    }

    // Step 7: Calculate totalPrice
    const totalPrice = verifiedComponents.reduce((sum, c) => sum + c.product.price, 0);

    // Step 8: Save to AIConversation
    let conversationId: string | undefined;
    if (req.user) {
      const conversation = await AIConversation.create({
        userId: req.user._id,
        messages: [
          { role: "user", content: `Generate ${purpose} build with budget $${budget}` },
          { role: "assistant", content: responseText.substring(0, 2000) },
        ],
      });
      conversationId = conversation._id.toString();
    }

    // Step 9: Return response
    sendSuccess(res, {
      build: {
        components: verifiedComponents.map((c) => ({
          category: c.category,
          productId: c.productId,
          product: c.product,
          reasoning: c.reasoning,
        })),
        totalPrice,
        reasoning: {
          overall: parsed.overallReasoning,
        },
      },
      conversationId: conversationId || null,
    });
  } catch (error) {
    // Gemini API outage or any other error
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("API") || message.includes("quota") || message.includes("SAFETY")) {
      return sendError(res, "AI service temporarily unavailable", 502, "AI_ERROR", message);
    }
    sendError(res, "Failed to generate build", 500, "SERVER_ERROR", message);
  }
});

export default router;
