import { Router, Request, Response } from "express";
import Review from "../models/Review";
import Product from "../models/Product";
import { sendSuccess, sendError } from "../utils/response";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// GET /api/v1/products/:productId/reviews
router.get("/products/:productId/reviews", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { page = "1", limit = "10" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total, ratingResult] = await Promise.all([
      Review.find({ productId })
        .populate("userId", "name avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments({ productId }),
      Review.aggregate([
        { $match: { productId: productId } },
        { $group: { _id: null, avg: { $avg: "$rating" } } },
      ]),
    ]);

    const averageRating = ratingResult.length > 0 ? Math.round(ratingResult[0].avg * 10) / 10 : 0;

    sendSuccess(res, { reviews, averageRating, total });
  } catch (error) {
    sendError(res, "Failed to fetch reviews", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// POST /api/v1/products/:productId/reviews — protected
router.post("/products/:productId/reviews", authenticate, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user!._id;

    if (!rating || rating < 1 || rating > 5) {
      return sendError(res, "Rating must be between 1 and 5", 400, "VALIDATION_ERROR", "rating: must be 1-5");
    }
    if (!comment?.trim()) {
      return sendError(res, "Comment is required", 400, "VALIDATION_ERROR", "comment: required");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return sendError(res, "Product not found", 404, "NOT_FOUND", `No product with id ${productId}`);
    }

    const existingReview = await Review.findOne({ userId, productId });
    if (existingReview) {
      return sendError(res, "You have already reviewed this product", 409, "VALIDATION_ERROR", "You can only review a product once");
    }

    const review = await Review.create({ userId, productId, rating, comment });

    // Recalculate product average rating and review count
    const stats = await Review.aggregate([
      { $match: { productId: product._id } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    if (stats.length > 0) {
      product.rating = Math.round(stats[0].avg * 10) / 10;
      product.reviewCount = stats[0].count;
      await product.save();
    }

    sendSuccess(res, { review }, "Review created", 201);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return sendError(res, "You have already reviewed this product", 409, "VALIDATION_ERROR", "You can only review a product once");
    }
    sendError(res, "Failed to create review", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// DELETE /api/v1/reviews/:id — owner or admin
router.delete("/reviews/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return sendError(res, "Review not found", 404, "NOT_FOUND", `No review with id ${req.params.id}`);
    }

    const isOwner = review.userId.toString() === req.user!._id.toString();
    const isAdmin = req.user!.role === "admin";
    if (!isOwner && !isAdmin) {
      return sendError(res, "Not authorized to delete this review", 403, "FORBIDDEN", "Only the review owner or admin can delete");
    }

    const productId = review.productId;
    await Review.findByIdAndDelete(req.params.id);

    // Recalculate product stats after deletion
    const stats = await Review.aggregate([
      { $match: { productId } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    const product = await Product.findById(productId);
    if (product) {
      if (stats.length > 0) {
        product.rating = Math.round(stats[0].avg * 10) / 10;
        product.reviewCount = stats[0].count;
      } else {
        product.rating = 0;
        product.reviewCount = 0;
      }
      await product.save();
    }

    sendSuccess(res, null, "Review deleted");
  } catch (error) {
    sendError(res, "Failed to delete review", 500, "SERVER_ERROR", (error as Error).message);
  }
});

export default router;
