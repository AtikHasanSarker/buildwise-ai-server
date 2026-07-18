import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Product, { ProductCategory, IProduct } from "../models/Product";
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

// ---------------------------------------------------------------------------
// POST /api/v1/ai/check-compatibility
// ---------------------------------------------------------------------------

interface ComponentInput {
  productId: string;
  category: string;
}

interface CompatibilityIssue {
  componentA: { productId: string; name: string };
  componentB: { productId: string; name: string };
  issue: string;
  suggestion: string;
  alternativeProducts: unknown[];
}

// Lean product type (matches .lean() output)
type LeanProduct = {
  _id: { toString(): string };
  name: string;
  brand: string;
  category: string;
  price: number;
  description: string;
  images: string[];
  specifications: Record<string, unknown>;
  rating: number;
  reviewCount: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
};

// Extract DDR generation from RAM speed string (e.g. "DDR5-6000" → "DDR5")
const extractRamGeneration = (speed?: string): string | null => {
  if (!speed) return null;
  const match = speed.toUpperCase().match(/DDR\d/);
  return match ? match[0] : null;
};

// Estimate power draw from a component's specs
const estimateWattageDraw = (product: LeanProduct): number => {
  const specs = product.specifications;
  if (typeof specs.tdp === "number") return specs.tdp;
  if (typeof specs.wattageDraw === "number") return specs.wattageDraw;
  const estimates: Record<string, number> = {
    CPU: 125, GPU: 200, Motherboard: 50, RAM: 10, SSD: 10,
    HDD: 10, PSU: 0, Case: 5, Cooler: 10,
  };
  return estimates[product.category] ?? 30;
};

const runRuleBasedChecks = (
  products: LeanProduct[]
): { pair: [string, string]; issue: string }[] => {
  const issues: { pair: [string, string]; issue: string }[] = [];
  const byCategory = new Map<string, LeanProduct>();
  for (const p of products) byCategory.set(p.category, p);

  // 1. CPU ↔ Motherboard socket
  const cpu = byCategory.get("CPU");
  const mobo = byCategory.get("Motherboard");
  if (cpu && mobo) {
    const cpuSocket = (cpu.specifications as Record<string, unknown>).socket as string | undefined;
    const moboSocket = (mobo.specifications as Record<string, unknown>).socket as string | undefined;
    if (cpuSocket && moboSocket) {
      if (cpuSocket !== moboSocket) {
        issues.push({
          pair: [cpu._id.toString(), mobo._id.toString()],
          issue: `CPU socket ${cpuSocket} is not compatible with motherboard socket ${moboSocket}`,
        });
      }
    }
  }

  // 2. RAM ↔ Motherboard DDR generation
  const ram = byCategory.get("RAM");
  if (ram && mobo) {
    const ramSpeed = (ram.specifications as Record<string, unknown>).speed as string | undefined;
    const ramGen = extractRamGeneration(ramSpeed);
    // Determine motherboard DDR support from chipset or infer from socket
    const moboSpecs = mobo.specifications as Record<string, unknown>;
    const moboSocket = moboSpecs.socket as string | undefined;
    // AM5 = DDR5, LGA1700 supports both but Z790 = DDR5, B660/B760 = DDR4 or DDR5
    let moboRamGen: string | null = null;
    if (moboSocket === "AM5") moboRamGen = "DDR5";
    else if (moboSocket === "LGA1700") {
      const chipset = (moboSpecs.chipset as string) || "";
      moboRamGen = chipset.startsWith("Z") ? "DDR5" : null; // Z-series = DDR5, others ambiguous
    }

    if (ramGen && moboRamGen && ramGen !== moboRamGen) {
      issues.push({
        pair: [ram._id.toString(), mobo._id.toString()],
        issue: `RAM type ${ramGen} is not compatible with motherboard which requires ${moboRamGen}`,
      });
    }
  }

  // 3. PSU wattage vs CPU+GPU draw (20% headroom)
  const psu = byCategory.get("PSU");
  if (psu) {
    const psuWattage = (psu.specifications as Record<string, unknown>).wattage as number | undefined;
    if (psuWattage) {
      let totalDraw = 0;
      for (const p of products) {
        if (p.category === "CPU" || p.category === "GPU") {
          totalDraw += estimateWattageDraw(p);
        }
      }
      const required = totalDraw * 1.2;
      if (psuWattage < required) {
        const conflictingIds: string[] = [];
        if (cpu) conflictingIds.push(cpu._id.toString());
        if (byCategory.get("GPU")) conflictingIds.push(byCategory.get("GPU")!._id.toString());
        issues.push({
          pair: [psu._id.toString(), ...conflictingIds] as [string, string],
          issue: `PSU ${psuWattage}W provides insufficient power — system requires at least ${Math.round(required)}W (${Math.round(totalDraw)}W draw + 20% headroom)`,
        });
      }
    }
  }

  // 4. SSD interface vs Motherboard M.2 slots
  const ssd = byCategory.get("SSD") || byCategory.get("HDD");
  if (ssd && mobo) {
    const ssdSpecs = ssd.specifications as Record<string, unknown>;
    const ssdInterface = ssdSpecs.interface as string | undefined;
    const ssdFormFactor = ssdSpecs.formFactor as string | undefined;
    const moboSpecs2 = mobo.specifications as Record<string, unknown>;
    const m2Slots = moboSpecs2.m2Slots as number | undefined;

    // If it's an M.2 NVMe SSD but mobo has no M.2 slots
    if (ssdFormFactor?.includes("M.2") && ssdInterface?.includes("NVMe")) {
      if (typeof m2Slots === "number" && m2Slots === 0) {
        issues.push({
          pair: [ssd._id.toString(), mobo._id.toString()],
          issue: `NVMe SSD requires an M.2 slot but the motherboard has none`,
        });
      }
    }
  }

  // 5. GPU length vs Case clearance
  const gpu = byCategory.get("GPU");
  const case_ = byCategory.get("Case");
  if (gpu && case_) {
    const gpuLength = (gpu.specifications as Record<string, unknown>).length as string | undefined;
    const caseSpecs = case_.specifications as Record<string, unknown>;
    const maxGpuLength = caseSpecs.maxGpuLength as string | undefined;
    if (gpuLength && maxGpuLength) {
      const gpuMm = parseFloat(gpuLength);
      const caseMm = parseFloat(maxGpuLength);
      if (!isNaN(gpuMm) && !isNaN(caseMm) && gpuMm > caseMm) {
        issues.push({
          pair: [gpu._id.toString(), case_._id.toString()],
          issue: `GPU length ${gpuLength} exceeds case maximum GPU clearance of ${maxGpuLength}`,
        });
      }
    }
  }

  // 6. Cooler height vs Case clearance
  const cooler = byCategory.get("Cooler");
  if (cooler && case_) {
    const coolerHeight = (cooler.specifications as Record<string, unknown>).height as string | undefined;
    const caseSpecs3 = case_.specifications as Record<string, unknown>;
    const maxCoolerHeight = caseSpecs3.maxCoolerHeight as string | undefined;
    if (coolerHeight && maxCoolerHeight) {
      const coolerMm = parseFloat(coolerHeight);
      const caseMm = parseFloat(maxCoolerHeight);
      if (!isNaN(coolerMm) && !isNaN(caseMm) && coolerMm > caseMm) {
        issues.push({
          pair: [cooler._id.toString(), case_._id.toString()],
          issue: `CPU cooler height ${coolerHeight} exceeds case maximum cooler height of ${maxCoolerHeight}`,
        });
      }
    }
  }

  return issues;
};

const generateExplanation = async (
  genAI: GoogleGenerativeAI,
  productA: LeanProduct,
  productB: LeanProduct,
  issueText: string
): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `You are a PC hardware expert. Explain this compatibility issue in 1-2 clear sentences.
Return ONLY valid JSON: { "issue": "your explanation" }

Product A: ${productA.name} (${productA.category})
Product B: ${productB.name} (${productB.category})
Problem: ${issueText}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(text);
    return parsed.issue || issueText;
  } catch {
    return issueText;
  }
};

const findAlternatives = async (
  incompatibleProduct: LeanProduct,
  _otherProducts: LeanProduct[],
  requiredSpec: { key: string; value: unknown }
): Promise<unknown[]> => {
  const query: Record<string, unknown> = {
    category: incompatibleProduct.category,
    stock: { $gt: 0 },
    _id: { $ne: incompatibleProduct._id },
  };

  // Find products where the required spec matches
  const candidates = await Product.find(query)
    .select("name brand price category specifications images rating stock")
    .lean();

  return candidates
    .filter((c) => {
      const specs = c.specifications as Record<string, unknown>;
      return specs[requiredSpec.key] === requiredSpec.value;
    })
    .slice(0, 3);
};

// POST /api/v1/ai/check-compatibility
router.post("/check-compatibility", async (req: Request, res: Response) => {
  try {
    const { components } = req.body as { components?: ComponentInput[] };

    // Step 1: Validate input
    if (!components || !Array.isArray(components) || components.length < 2) {
      return sendError(
        res,
        "At least 2 components are required",
        400,
        "VALIDATION_ERROR",
        "components: must be an array with at least 2 items"
      );
    }

    const productIds = components.map((c) => c.productId);
    const existingProducts = await Product.find({ _id: { $in: productIds } }).lean();

    if (existingProducts.length !== productIds.length) {
      const foundIds = new Set(existingProducts.map((p) => p._id.toString()));
      const missing = productIds.filter((id) => !foundIds.has(id));
      return sendError(
        res,
        "Some products were not found",
        400,
        "VALIDATION_ERROR",
        `Products not found: ${missing.join(", ")}`
      );
    }

    // Step 2: Build product map
    const productMap = new Map(existingProducts.map((p) => [p._id.toString(), p]));
    const orderedProducts = productIds.map((id) => productMap.get(id)!).filter(Boolean);

    // Step 3: Rule-based compatibility checks
    const rawIssues = runRuleBasedChecks(orderedProducts);

    if (rawIssues.length === 0) {
      return sendSuccess(res, {
        compatible: true,
        issues: [],
      }, "All components are compatible");
    }

    // Step 4 & 5: For each issue, get AI explanation + find alternatives
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

    const issues: CompatibilityIssue[] = [];

    for (const raw of rawIssues) {
      const idA = raw.pair[0];
      const idB = raw.pair[1];
      const prodA = productMap.get(idA)!;
      const prodB = productMap.get(idB)!;

      // AI explanation (graceful fallback)
      let explanation = raw.issue;
      if (genAI) {
        explanation = await generateExplanation(genAI, prodA, prodB, raw.issue);
      }

      // Find alternatives for the incompatible product (first in the pair)
      let alternativeProducts: unknown[] = [];
      const incompatible = prodA;
      const otherProduct = prodB;

      // Determine what spec we need for the alternative
      const incompatibleSpecs = incompatible.specifications as Record<string, unknown>;
      const otherSpecs = otherProduct.specifications as Record<string, unknown>;

      if (incompatible.category === "CPU") {
        // Need CPU with same socket as motherboard
        if (otherSpecs.socket) {
          alternativeProducts = await findAlternatives(incompatible, orderedProducts, {
            key: "socket",
            value: otherSpecs.socket,
          });
        }
      } else if (incompatible.category === "Motherboard") {
        // Need motherboard with same socket as CPU
        if (otherSpecs.socket) {
          alternativeProducts = await findAlternatives(incompatible, orderedProducts, {
            key: "socket",
            value: otherSpecs.socket,
          });
        }
      } else if (incompatible.category === "RAM") {
        // Need RAM with matching DDR generation
        const moboSpecs = otherSpecs;
        const moboSocket = moboSpecs.socket as string | undefined;
        let requiredGen: string | null = null;
        if (moboSocket === "AM5") requiredGen = "DDR5";
        else if (moboSocket === "LGA1700") {
          const chipset = (moboSpecs.chipset as string) || "";
          requiredGen = chipset.startsWith("Z") ? "DDR5" : null;
        }
        if (requiredGen) {
          const allRam = await Product.find({
            category: "RAM",
            stock: { $gt: 0 },
            _id: { $ne: incompatible._id },
          }).lean();
          alternativeProducts = allRam
            .filter((r) => {
              const gen = extractRamGeneration(
                (r.specifications as Record<string, unknown>).speed as string
              );
              return gen === requiredGen;
            })
            .slice(0, 3);
        }
      } else if (incompatible.category === "PSU") {
        // Need higher wattage PSU
        const totalDraw = orderedProducts
          .filter((p) => p.category === "CPU" || p.category === "GPU")
          .reduce((sum, p) => sum + estimateWattageDraw(p), 0);
        const requiredWattage = totalDraw * 1.2;
        const allPsu = await Product.find({
          category: "PSU",
          stock: { $gt: 0 },
          _id: { $ne: incompatible._id },
        }).lean();
        alternativeProducts = allPsu
          .filter((p) => {
            const w = (p.specifications as Record<string, unknown>).wattage as number;
            return w >= requiredWattage;
          })
          .sort((a, b) => a.price - b.price)
          .slice(0, 3);
      } else if (incompatible.category === "SSD" || incompatible.category === "HDD") {
        // Find compatible storage
        if (otherSpecs.m2Slots !== undefined) {
          const m2Slots = otherSpecs.m2Slots as number;
          if (m2Slots > 0) {
            // Find NVMe SSDs
            const allSsd = await Product.find({
              category: "SSD",
              stock: { $gt: 0 },
              _id: { $ne: incompatible._id },
            }).lean();
            alternativeProducts = allSsd.slice(0, 3);
          } else {
            // Find SATA drives
            const allStorage = await Product.find({
              category: { $in: ["SSD", "HDD"] },
              stock: { $gt: 0 },
              _id: { $ne: incompatible._id },
            }).lean();
            alternativeProducts = allStorage
              .filter((s) => {
                const iface = (s.specifications as Record<string, unknown>).interface as string;
                return iface?.includes("SATA");
              })
              .slice(0, 3);
          }
        }
      } else if (incompatible.category === "GPU") {
        // Find shorter GPU
        const maxLen = parseFloat(
          (otherSpecs.maxGpuLength as string) || "999"
        );
        const allGpu = await Product.find({
          category: "GPU",
          stock: { $gt: 0 },
          _id: { $ne: incompatible._id },
        }).lean();
        alternativeProducts = allGpu
          .filter((g) => {
            const len = parseFloat(
              (g.specifications as Record<string, unknown>).length as string || "0"
            );
            return !isNaN(len) && len <= maxLen;
          })
          .slice(0, 3);
      } else if (incompatible.category === "Cooler") {
        // Find shorter cooler
        const maxH = parseFloat(
          (otherSpecs.maxCoolerHeight as string) || "999"
        );
        const allCooler = await Product.find({
          category: "Cooler",
          stock: { $gt: 0 },
          _id: { $ne: incompatible._id },
        }).lean();
        alternativeProducts = allCooler
          .filter((c) => {
            const h = parseFloat(
              (c.specifications as Record<string, unknown>).height as string || "0"
            );
            return !isNaN(h) && h <= maxH;
          })
          .slice(0, 3);
      }

      issues.push({
        componentA: { productId: prodA._id.toString(), name: prodA.name },
        componentB: { productId: prodB._id.toString(), name: prodB.name },
        issue: explanation,
        suggestion: `Consider replacing ${prodA.name} with a compatible alternative`,
        alternativeProducts,
      });
    }

    sendSuccess(res, {
      compatible: false,
      issues,
    }, `Found ${issues.length} compatibility issue(s)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendError(res, "Failed to check compatibility", 500, "SERVER_ERROR", message);
  }
});

export default router;
