import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAIMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface IAIConversation extends Document {
  userId: Types.ObjectId;
  messages: IAIMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const aiMessageSchema = new Schema<IAIMessage>(
  {
    role: {
      type: String,
      required: true,
      enum: ["user", "assistant"],
    },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiConversationSchema = new Schema<IAIConversation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messages: { type: [aiMessageSchema], default: [] },
  },
  { timestamps: true }
);

aiConversationSchema.index({ userId: 1 });

const AIConversation = mongoose.model<IAIConversation>(
  "AIConversation",
  aiConversationSchema
);

export default AIConversation;
