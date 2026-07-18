import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Product from "../models/Product";
import { sendSuccess, sendError } from "../utils/response";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// GET /api/v1/favorites
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!._id)
      .populate("favorites")
      .lean();

    sendSuccess(res, { products: user?.favorites || [] });
  } catch (error) {
    sendError(res, "Failed to fetch favorites", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// POST /api/v1/favorites/:productId
router.post("/:productId", authenticate, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return sendError(res, "Product not found", 404, "NOT_FOUND", `No product with id ${productId}`);
    }

    const user = await User.findById(req.user!._id);
    if (!user) {
      return sendError(res, "User not found", 404, "NOT_FOUND", "User not found");
    }

    const alreadyFavorited = user.favorites.some(
      (id) => id.toString() === productId
    );

    if (alreadyFavorited) {
      return sendSuccess(res, { products: user.favorites }, "Already in favorites");
    }

    user.favorites.push(product._id as mongoose.Types.ObjectId);
    await user.save();

    sendSuccess(res, { products: user.favorites }, "Added to favorites", 201);
  } catch (error) {
    sendError(res, "Failed to add favorite", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// DELETE /api/v1/favorites/:productId
router.delete("/:productId", authenticate, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user!._id);
    if (!user) {
      return sendError(res, "User not found", 404, "NOT_FOUND", "User not found");
    }

    const index = user.favorites.findIndex(
      (id) => id.toString() === productId
    );

    if (index === -1) {
      return sendError(res, "Product not in favorites", 404, "NOT_FOUND", "Product not in favorites");
    }

    user.favorites.splice(index, 1);
    await user.save();

    sendSuccess(res, { products: user.favorites }, "Removed from favorites");
  } catch (error) {
    sendError(res, "Failed to remove favorite", 500, "SERVER_ERROR", (error as Error).message);
  }
});

export default router;
