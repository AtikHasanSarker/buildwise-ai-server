import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * Mongoose model for Better Auth's "user" collection.
 * Better Auth manages authentication (passwords, sessions, OAuth accounts).
 * This model exists so the backend can query users for business logic
 * (admin management, ownership checks, favorites, etc.).
 *
 * Collection name is "user" (not "users") to match Better Auth's schema.
 */
export interface IUser extends Document {
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  role: string;
  favorites: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String },
    role: { type: String, default: "user" },
    favorites: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("user", userSchema);

export default User;
