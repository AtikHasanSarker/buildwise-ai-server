import mongoose, { Document, Schema, Types } from "mongoose";

export interface IReview extends Document {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

reviewSchema.index({ productId: 1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

const Review = mongoose.model<IReview>("Review", reviewSchema);

export default Review;
