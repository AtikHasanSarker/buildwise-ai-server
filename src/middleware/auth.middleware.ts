import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface JWTPayload {
  userId: string;
  role: "user" | "admin";
}

export const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
};

export const generateRefreshToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "30d" });
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({
        success: false,
        data: null,
        message: "Authentication required",
        error: { code: "UNAUTHORIZED", details: "No token provided" },
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const user = await User.findById(decoded.userId).select(
      "name email role avatar"
    );
    if (!user) {
      res.status(401).json({
        success: false,
        data: null,
        message: "User not found",
        error: { code: "UNAUTHORIZED", details: "Invalid token" },
      });
      return;
    }

    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      data: null,
      message: "Invalid or expired token",
      error: { code: "UNAUTHORIZED", details: "Token verification failed" },
    });
  }
};
