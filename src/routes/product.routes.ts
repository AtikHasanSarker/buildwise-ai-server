import { Router, Request, Response } from "express";
import Product from "../models/Product";
import Category from "../models/Category";
import { sendSuccess, sendError } from "../utils/response";
import { authenticate } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";

const router = Router();

// GET /api/v1/products
router.get("/", async (req: Request, res: Response) => {
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
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));
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
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
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
router.post("/", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, brand, category, price, description, images, specifications, stock } = req.body;

    if (!name?.trim()) return sendError(res, "Name is required", 400, "VALIDATION_ERROR", "name: required");
    if (!brand?.trim()) return sendError(res, "Brand is required", 400, "VALIDATION_ERROR", "brand: required");
    if (!category) return sendError(res, "Category is required", 400, "VALIDATION_ERROR", "category: required");
    if (price == null || price < 0) return sendError(res, "Valid price is required", 400, "VALIDATION_ERROR", "price: must be >= 0");
    if (!description?.trim()) return sendError(res, "Description is required", 400, "VALIDATION_ERROR", "description: required");
    if (stock == null || stock < 0) return sendError(res, "Valid stock is required", 400, "VALIDATION_ERROR", "stock: must be >= 0");

    const validCategories = ["CPU", "GPU", "Motherboard", "RAM", "SSD", "HDD", "PSU", "Case", "Cooler"];
    if (!validCategories.includes(category)) {
      return sendError(res, "Invalid category", 400, "VALIDATION_ERROR", `category: must be one of ${validCategories.join(", ")}`);
    }

    const product = await Product.create({
      name: name.trim(),
      brand: brand.trim(),
      category,
      price,
      description: description.trim(),
      images: images || [],
      specifications: specifications || {},
      stock,
    });

    sendSuccess(res, { product }, "Product created", 201);
  } catch (error) {
    sendError(res, "Failed to create product", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// PUT /api/v1/products/:id — admin only
router.put("/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
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
