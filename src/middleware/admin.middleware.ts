import { Request, Response, NextFunction } from "express";

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      data: null,
      message: "Admin access required",
      error: { code: "FORBIDDEN", details: "Insufficient permissions" },
    });
    return;
  }
  next();
};
