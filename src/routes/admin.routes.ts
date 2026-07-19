import { Router, Request, Response } from "express";
import User from "../models/User";
import Product from "../models/Product";
import Build from "../models/Build";
import Review from "../models/Review";
import AIConversation from "../models/AIConversation";
import { sendSuccess, sendError } from "../utils/response";
import { authenticate } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import { validate } from "../middleware/validate";
import { updateRoleSchema } from "../validation/schemas";

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// GET /api/v1/admin/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalProducts,
      totalBuilds,
      totalAIConversations,
      totalAIMessages,
      revenueResult,
      productsByCategory,
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Build.countDocuments(),
      AIConversation.countDocuments(),
      AIConversation.aggregate([{ $unwind: "$messages" }, { $count: "total" }]),
      // Revenue estimate: sum of totalPrice across all saved builds
      // NOTE: This is an estimate, not real revenue — there is no payment system.
      Build.aggregate([{ $group: { _id: null, total: { $sum: "$totalPrice" } } }]),
      Product.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $project: { _id: 0, category: "$_id", count: 1 } },
        { $sort: { category: 1 } },
      ]),
    ]);

    // AI usage over time: conversations created per day, last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const aiUsageOverTime = await AIConversation.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: "$_id", count: 1 } },
      { $sort: { date: 1 } },
    ]);

    // User growth over time: cumulative signups per day, last 30 days
    const userGrowthRaw = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: "$_id", count: 1 } },
      { $sort: { date: 1 } },
    ]);

    // Build cumulative sum for user growth
    let cumulative = 0;
    const userGrowthOverTime = userGrowthRaw.map((entry) => {
      cumulative += entry.count;
      return { date: entry.date, count: cumulative };
    });

    const totalAIRequests = totalAIMessages.length > 0 ? totalAIMessages[0].total : 0;
    const revenueEstimate = revenueResult.length > 0 ? revenueResult[0].total : 0;

    sendSuccess(res, {
      totalUsers,
      totalProducts,
      totalBuilds,
      totalAIRequests,
      // Estimated revenue from saved builds — NOT real revenue, no payment system exists
      revenueEstimate,
      productsByCategory,
      aiUsageOverTime,
      userGrowthOverTime,
    });
  } catch (error) {
    sendError(res, "Failed to fetch stats", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// GET /api/v1/admin/users
router.get("/users", async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", search } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};
    if (search && typeof search === "string") {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: safeSearch, $options: "i" };
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email role avatar createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    sendSuccess(res, { users, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error) {
    sendError(res, "Failed to fetch users", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// PUT /api/v1/admin/users/:id/role
router.put("/users/:id/role", validate(updateRoleSchema), async (req: Request, res: Response) => {
  try {
    const { role } = req.body;

    // Prevent admin from demoting themselves
    if (req.user!._id.toString() === req.params.id) {
      return sendError(res, "Cannot change your own role", 400, "VALIDATION_ERROR", "Admin cannot demote themselves");
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return sendError(res, "User not found", 404, "NOT_FOUND", `No user with id ${req.params.id}`);
    }

    // Prevent demoting the last admin
    if (targetUser.role === "admin" && role === "user") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return sendError(res, "Cannot demote the last admin", 400, "VALIDATION_ERROR", "At least one admin must remain");
      }
    }

    targetUser.role = role;
    await targetUser.save();

    sendSuccess(res, {
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
    }, "User role updated");
  } catch (error) {
    sendError(res, "Failed to update user role", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// DELETE /api/v1/admin/users/:id
// Cascade policy:
// - Reviews by this user are DELETED (keeps product rating integrity after recalculation)
// - AI Conversations are DELETED (no value keeping orphaned chat history)
// - Builds are DELETED (orphaned builds serve no purpose)
// - User is removed from all favorites arrays (clean up references)
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    // Prevent admin from deleting themselves
    if (req.user!._id.toString() === req.params.id) {
      return sendError(res, "Cannot delete your own account", 400, "VALIDATION_ERROR", "Admin cannot delete themselves");
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return sendError(res, "User not found", 404, "NOT_FOUND", `No user with id ${req.params.id}`);
    }

    // Prevent deleting the last admin
    if (targetUser.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return sendError(res, "Cannot delete the last admin", 400, "VALIDATION_ERROR", "At least one admin must remain");
      }
    }

    // Cascade deletes
    await Promise.all([
      Review.deleteMany({ userId: targetUser._id }),
      AIConversation.deleteMany({ userId: targetUser._id }),
      Build.deleteMany({ userId: targetUser._id }),
      // Remove user from all favorites arrays
      User.updateMany(
        { favorites: targetUser._id },
        { $pull: { favorites: targetUser._id } }
      ),
    ]);

    await User.findByIdAndDelete(req.params.id);

    sendSuccess(res, null, "User deleted");
  } catch (error) {
    sendError(res, "Failed to delete user", 500, "SERVER_ERROR", (error as Error).message);
  }
});

export default router;
