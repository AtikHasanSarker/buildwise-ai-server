import { Router, Request, Response } from "express";
import Build from "../models/Build";
import Product from "../models/Product";
import { sendSuccess, sendError } from "../utils/response";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// POST /api/v1/builds
router.post("/", authenticate, async (req: Request, res: Response) => {
  try {
    const { name, components, totalPrice, aiRecommendation } = req.body;

    if (!name?.trim()) {
      return sendError(res, "Build name is required", 400, "VALIDATION_ERROR", "name: required");
    }
    if (!components || !Array.isArray(components) || components.length === 0) {
      return sendError(res, "At least one component is required", 400, "VALIDATION_ERROR", "components: required, must be non-empty array");
    }
    if (totalPrice == null || totalPrice < 0) {
      return sendError(res, "Valid total price is required", 400, "VALIDATION_ERROR", "totalPrice: must be >= 0");
    }

    // Validate every productId exists
    const productIds = components.map((c: { productId: string }) => c.productId);
    const existingProducts = await Product.find({ _id: { $in: productIds } }).select("_id").lean();
    const existingIds = new Set(existingProducts.map((p) => p._id.toString()));

    const missing = productIds.filter((id: string) => !existingIds.has(id));
    if (missing.length > 0) {
      return sendError(
        res,
        "Some products were not found",
        400,
        "VALIDATION_ERROR",
        `Products not found: ${missing.join(", ")}`
      );
    }

    const build = await Build.create({
      userId: req.user!._id,
      name: name.trim(),
      components,
      totalPrice,
      aiRecommendation,
    });

    sendSuccess(res, { build }, "Build created", 201);
  } catch (error) {
    sendError(res, "Failed to create build", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// GET /api/v1/builds
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "10" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [builds, total] = await Promise.all([
      Build.find({ userId: req.user!._id })
        .populate("components.productId", "name images price category brand")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Build.countDocuments({ userId: req.user!._id }),
    ]);

    sendSuccess(res, { builds, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error) {
    sendError(res, "Failed to fetch builds", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// GET /api/v1/builds/:id
router.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const build = await Build.findById(req.params.id)
      .populate("components.productId", "name images price category brand specifications")
      .lean();

    if (!build) {
      return sendError(res, "Build not found", 404, "NOT_FOUND", `No build with id ${req.params.id}`);
    }

    const isOwner = build.userId.toString() === req.user!._id.toString();
    const isAdmin = req.user!.role === "admin";
    if (!isOwner && !isAdmin) {
      return sendError(res, "Not authorized to view this build", 403, "FORBIDDEN", "Only the build owner or admin can view");
    }

    sendSuccess(res, { build });
  } catch (error) {
    sendError(res, "Failed to fetch build", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// PUT /api/v1/builds/:id — owner only
router.put("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const build = await Build.findById(req.params.id);
    if (!build) {
      return sendError(res, "Build not found", 404, "NOT_FOUND", `No build with id ${req.params.id}`);
    }

    if (build.userId.toString() !== req.user!._id.toString()) {
      return sendError(res, "Not authorized to update this build", 403, "FORBIDDEN", "Only the build owner can update");
    }

    const { name, totalPrice } = req.body;
    if (name !== undefined) build.name = name.trim();
    if (totalPrice !== undefined) build.totalPrice = totalPrice;
    await build.save();

    sendSuccess(res, { build }, "Build updated");
  } catch (error) {
    sendError(res, "Failed to update build", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// DELETE /api/v1/builds/:id — owner only
router.delete("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const build = await Build.findById(req.params.id);
    if (!build) {
      return sendError(res, "Build not found", 404, "NOT_FOUND", `No build with id ${req.params.id}`);
    }

    if (build.userId.toString() !== req.user!._id.toString()) {
      return sendError(res, "Not authorized to delete this build", 403, "FORBIDDEN", "Only the build owner can delete");
    }

    await Build.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, "Build deleted");
  } catch (error) {
    sendError(res, "Failed to delete build", 500, "SERVER_ERROR", (error as Error).message);
  }
});

export default router;
