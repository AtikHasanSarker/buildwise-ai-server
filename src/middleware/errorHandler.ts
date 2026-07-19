import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { sendError } from "../utils/response";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Zod validation errors
  if (err instanceof ZodError) {
    const details = err.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", details);
    return;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", err.message);
    return;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    sendError(res, "Invalid ID format", 400, "VALIDATION_ERROR", "The provided ID is not valid");
    return;
  }

  // Duplicate key error
  if ((err as { code?: number }).code === 11000) {
    sendError(res, "Duplicate value", 409, "VALIDATION_ERROR", "A record with this value already exists");
    return;
  }

  // Log error server-side (never log passwords or tokens)
  console.error(`[ERROR] ${err.message}`, {
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });

  sendError(
    res,
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
    500,
    "SERVER_ERROR",
    process.env.NODE_ENV === "production" ? "" : err.stack || ""
  );
};
