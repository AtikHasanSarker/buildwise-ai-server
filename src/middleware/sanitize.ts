import { Request, Response, NextFunction } from "express";

// Prevent NoSQL injection by rejecting objects/arrays where strings are expected.
// Express body-parser already handles this for JSON bodies, but query strings
// can be manipulated to pass objects (e.g. ?search[$ne]=).
const isUnsafeValue = (value: unknown): boolean => {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(isUnsafeValue);
  }
  return false;
};

const sanitizeObject = (obj: Record<string, unknown>): void => {
  for (const key of Object.keys(obj)) {
    if (isUnsafeValue(obj[key])) {
      delete obj[key];
    }
  }
};

// Sanitize req.query to prevent NoSQL injection via query params
export const sanitizeQuery = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.query && typeof req.query === "object") {
    sanitizeObject(req.query as Record<string, unknown>);
  }
  next();
};

// Sanitize req.body to prevent prototype pollution
export const sanitizeBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === "object") {
    // Reject __proto__, constructor, prototype keys
    const dangerousKeys = ["__proto__", "constructor", "prototype"];
    for (const key of dangerousKeys) {
      if (key in req.body) {
        delete req.body[key];
      }
    }
  }
  next();
};
