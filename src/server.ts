import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";
import reviewRoutes from "./routes/review.routes";
import favoriteRoutes from "./routes/favorite.routes";
import buildRoutes from "./routes/build.routes";
import aiRoutes from "./routes/ai.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1", reviewRoutes);
app.use("/api/v1/favorites", favoriteRoutes);
app.use("/api/v1/builds", buildRoutes);
app.use("/api/v1/ai", aiRoutes);

// Error handling
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export default app;
