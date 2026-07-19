import { Router, Request, Response } from "express";
import Product from "../models/Product";
import Category from "../models/Category";
import { sendSuccess, sendError } from "../utils/response";
import { authenticate } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import { validate, validateQuery } from "../middleware/validate";
import { createProductSchema, updateProductSchema, productsQuerySchema } from "../validation/schemas";

const router = Router();

// Escape special regex characters in search input
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// GET /api/v1/products
router.get("/", validateQuery(productsQuerySchema), async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "12",
      category,
      brand,
      minPrice,
      maxPrice,
      search,
      sort,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) (filter.price as Record<string, number>).$gte = Number(minPrice);
      if (maxPrice) (filter.price as Record<string, number>).$lte = Number(maxPrice);
    }
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { brand: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } },
      ];
    }

    let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    else if (sort === "price_desc") sortOption = { price: -1 };
    else if (sort === "rating") sortOption = { rating: -1 };
    else if (sort === "newest") sortOption = { createdAt: -1 };

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortOption).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(filter),
    ]);

    sendSuccess(res, {
      products,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    sendError(res, "Failed to fetch products", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// GET /api/v1/products/categories
router.get("/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    sendSuccess(res, { categories });
  } catch (error) {
    sendError(res, "Failed to fetch categories", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// GET /api/v1/products/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return sendError(res, "Product not found", 404, "NOT_FOUND", `No product with id ${req.params.id}`);
    }
    sendSuccess(res, { product });
  } catch (error) {
    sendError(res, "Failed to fetch product", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// POST /api/v1/products — admin only
router.post("/", authenticate, requireAdmin, validate(createProductSchema), async (req: Request, res: Response) => {
  try {
    const product = await Product.create(req.body);
    sendSuccess(res, { product }, "Product created", 201);
  } catch (error) {
    sendError(res, "Failed to create product", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// PUT /api/v1/products/:id — admin only
router.put("/:id", authenticate, requireAdmin, validate(updateProductSchema), async (req: Request, res: Response) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();

    if (!product) {
      return sendError(res, "Product not found", 404, "NOT_FOUND", `No product with id ${req.params.id}`);
    }

    sendSuccess(res, { product }, "Product updated");
  } catch (error) {
    sendError(res, "Failed to update product", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// DELETE /api/v1/products/:id — admin only
router.delete("/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return sendError(res, "Product not found", 404, "NOT_FOUND", `No product with id ${req.params.id}`);
    }
    sendSuccess(res, null, "Product deleted");
  } catch (error) {
    sendError(res, "Failed to delete product", 500, "SERVER_ERROR", (error as Error).message);
  }
});

export default router;
