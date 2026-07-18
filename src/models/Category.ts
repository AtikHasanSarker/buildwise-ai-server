import mongoose, { Document, Schema } from "mongoose";

export interface ICategory extends Document {
  name: string;
  slug: string;
  icon?: string;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  icon: { type: String },
});

const Category = mongoose.model<ICategory>("Category", categorySchema);

export default Category;
