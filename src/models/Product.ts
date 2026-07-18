import mongoose, { Document, Schema } from "mongoose";

export type ProductCategory =
  | "CPU"
  | "GPU"
  | "Motherboard"
  | "RAM"
  | "SSD"
  | "HDD"
  | "PSU"
  | "Case"
  | "Cooler";

export interface IProduct extends Document {
  name: string;
  brand: string;
  category: ProductCategory;
  price: number;
  description: string;
  images: string[];
  specifications: Record<string, unknown>;
  rating: number;
  reviewCount: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        "CPU",
        "GPU",
        "Motherboard",
        "RAM",
        "SSD",
        "HDD",
        "PSU",
        "Case",
        "Cooler",
      ],
    },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    specifications: { type: Schema.Types.Mixed, default: {} },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    stock: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ name: "text", description: "text" });

const Product = mongoose.model<IProduct>("Product", productSchema);

export default Product;
