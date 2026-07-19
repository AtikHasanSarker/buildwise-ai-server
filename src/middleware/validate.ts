import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { sendError } from "../utils/response";

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      sendError(res, "Validation failed", 400, "VALIDATION_ERROR", details);
      return;
    }
    req.body = result.data;
    next();
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      sendError(res, "Invalid query parameters", 400, "VALIDATION_ERROR", details);
      return;
    }
    req.query = result.data as Record<string, string>;
    next();
  };
};
