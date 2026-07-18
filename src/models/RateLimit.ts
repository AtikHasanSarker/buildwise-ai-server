import mongoose, { Document, Schema } from "mongoose";

export interface IRateLimit extends Document {
  identifier: string;
  date: string;
  count: number;
}

const rateLimitSchema = new Schema<IRateLimit>({
  identifier: { type: String, required: true },
  date: { type: String, required: true },
  count: { type: Number, default: 0 },
});

rateLimitSchema.index({ identifier: 1, date: 1 }, { unique: true });

const RateLimit = mongoose.model<IRateLimit>("RateLimit", rateLimitSchema);

export default RateLimit;
