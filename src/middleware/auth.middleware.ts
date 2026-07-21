import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

/**
 * Authenticate via Better Auth session cookie.
 * Better Auth stores sessions in the "session" collection and users in "user".
 * The session cookie is named "better-auth.session_token" by default.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionToken =
      req.cookies?.["better-auth.session_token"] ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!sessionToken) {
      res.status(401).json({
        success: false,
        data: null,
        message: "Authentication required",
        error: { code: "UNAUTHORIZED", details: "No session token provided" },
      });
      return;
    }

    const db = mongoose.connection.db;
    if (!db) {
      res.status(500).json({
        success: false,
        data: null,
        message: "Database not connected",
        error: { code: "SERVER_ERROR", details: "DB connection unavailable" },
      });
      return;
    }

    const session = await db.collection("session").findOne({ token: sessionToken });
    if (!session) {
      res.status(401).json({
        success: false,
        data: null,
        message: "Invalid session",
        error: { code: "UNAUTHORIZED", details: "Session not found" },
      });
      return;
    }

    if (new Date(session.expiresAt) < new Date()) {
      res.status(401).json({
        success: false,
        data: null,
        message: "Session expired",
        error: { code: "UNAUTHORIZED", details: "Session has expired" },
      });
      return;
    }

    const user = await db.collection("user").findOne({ _id: session.userId });
    if (!user) {
      res.status(401).json({
        success: false,
        data: null,
        message: "User not found",
        error: { code: "UNAUTHORIZED", details: "User no longer exists" },
      });
      return;
    }

    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
      avatar: user.image,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      data: null,
      message: "Authentication failed",
      error: { code: "UNAUTHORIZED", details: "Session verification failed" },
    });
  }
};

/**
 * Optional authentication — sets req.user if a valid session exists,
 * but does NOT reject unauthenticated requests (guests allowed).
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionToken =
      req.cookies?.["better-auth.session_token"] ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!sessionToken) {
      return next();
    }

    const db = mongoose.connection.db;
    if (!db) {
      return next();
    }

    const session = await db.collection("session").findOne({ token: sessionToken });
    if (!session || new Date(session.expiresAt) < new Date()) {
      return next();
    }

    const user = await db.collection("user").findOne({ _id: session.userId });
    if (user) {
      req.user = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "user",
        avatar: user.image,
      };
    }
  } catch {
    // Invalid session — treat as guest, don't reject
  }

  next();
};
