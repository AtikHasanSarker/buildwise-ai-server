import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import connectDB from "./config/db";
import { sanitizeQuery, sanitizeBody } from "./middleware/sanitize";
import { errorHandler } from "./middleware/errorHandler";
import healthRoutes from "./routes/health";
import productRoutes from "./routes/product.routes";
import reviewRoutes from "./routes/review.routes";
import favoriteRoutes from "./routes/favorite.routes";
import buildRoutes from "./routes/build.routes";
import aiRoutes from "./routes/ai.routes";
import adminRoutes from "./routes/admin.routes";

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet());

// Request logging (dev mode only — no sensitive data logged)
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// CORS — only allow the actual frontend origin
if (!process.env.CLIENT_URL) {
  throw new Error("CLIENT_URL environment variable is required");
}
const allowedOrigins = process.env.CLIENT_URL.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "10mb" }));

// Cookie parsing — needed to read Better Auth session cookies
app.use(cookieParser());

// Input sanitization (NoSQL injection prevention)
app.use(sanitizeQuery);
app.use(sanitizeBody);

// Routes
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1", reviewRoutes);
app.use("/api/v1/favorites", favoriteRoutes);
app.use("/api/v1/builds", buildRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/admin", adminRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: "Route not found",
    error: { code: "NOT_FOUND", details: "The requested endpoint does not exist" },
  });
});

// Global error handler (must be last)
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export default app;
