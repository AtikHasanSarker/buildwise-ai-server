import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error("Unhandled error:", err.message);

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
