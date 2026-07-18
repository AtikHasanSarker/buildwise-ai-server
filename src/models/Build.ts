import mongoose, { Document, Schema, Types } from "mongoose";

export interface IBuildComponent {
  productId: Types.ObjectId;
  category: string;
}

export interface IBuild extends Document {
  userId: Types.ObjectId;
  name: string;
  components: IBuildComponent[];
  totalPrice: number;
  aiRecommendation?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const buildComponentSchema = new Schema<IBuildComponent>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    category: { type: String, required: true },
  },
  { _id: false }
);

const buildSchema = new Schema<IBuild>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    components: { type: [buildComponentSchema], default: [] },
    totalPrice: { type: Number, required: true, min: 0 },
    aiRecommendation: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

buildSchema.index({ userId: 1 });

const Build = mongoose.model<IBuild>("Build", buildSchema);

export default Build;
