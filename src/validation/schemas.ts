import { z } from "zod";

const VALID_CATEGORIES = ["CPU", "GPU", "Motherboard", "RAM", "SSD", "HDD", "PSU", "Case", "Cooler"] as const;

// Auth
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, "Google token is required"),
});

// Products
export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  brand: z.string().trim().min(1, "Brand is required"),
  category: z.enum(VALID_CATEGORIES, { message: `Category must be one of: ${VALID_CATEGORIES.join(", ")}` }),
  price: z.number().min(0, "Price must be >= 0"),
  description: z.string().trim().min(1, "Description is required"),
  images: z.array(z.string()).optional().default([]),
  specifications: z.record(z.string(), z.unknown()).optional().default({}),
  stock: z.number().min(0, "Stock must be >= 0"),
});

export const updateProductSchema = createProductSchema.partial();

export const productsQuerySchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("12"),
  category: z.enum(VALID_CATEGORIES).optional(),
  brand: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(["price_asc", "price_desc", "rating", "newest"]).optional(),
});

// Reviews
export const createReviewSchema = z.object({
  rating: z.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
  comment: z.string().trim().min(1, "Comment is required"),
});

// Builds
export const createBuildSchema = z.object({
  name: z.string().trim().min(1, "Build name is required"),
  components: z.array(z.object({
    productId: z.string().min(1),
    category: z.string().min(1),
  })).min(1, "At least one component is required"),
  totalPrice: z.number().min(0, "Total price must be >= 0"),
  aiRecommendation: z.record(z.string(), z.unknown()).optional(),
});

export const updateBuildSchema = z.object({
  name: z.string().trim().min(1).optional(),
  totalPrice: z.number().min(0).optional(),
});

// AI
export const generateBuildSchema = z.object({
  budget: z.number().positive("Budget must be a positive number"),
  purpose: z.enum(["gaming", "programming", "editing", "office"], {
    message: "Purpose must be gaming, programming, editing, or office",
  }),
  preferredBrand: z.array(z.string()).optional(),
});

export const checkCompatibilitySchema = z.object({
  components: z.array(z.object({
    productId: z.string().min(1),
    category: z.string().min(1),
  })).min(2, "At least 2 components are required"),
});

export const chatSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
  conversationId: z.string().optional(),
});

// Admin
export const updateRoleSchema = z.object({
  role: z.enum(["user", "admin"], {
    message: "Role must be user or admin",
  }),
});
