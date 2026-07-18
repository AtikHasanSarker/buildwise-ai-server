import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { sendSuccess, sendError } from "../utils/response";
import {
  authenticate,
  generateToken,
  generateRefreshToken,
} from "../middleware/auth.middleware";

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const setTokenCookie = (res: Response, token: string, maxAge: number) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
  });
};

const sanitizeUser = (user: { _id: unknown; name: string; email: string; role: string; avatar?: string }) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
});

// POST /api/v1/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim()) {
      return sendError(res, "Name is required", 400, "VALIDATION_ERROR", "name: required");
    }
    if (!email?.trim()) {
      return sendError(res, "Email is required", 400, "VALIDATION_ERROR", "email: required");
    }
    if (!EMAIL_REGEX.test(email)) {
      return sendError(res, "Invalid email format", 400, "VALIDATION_ERROR", "email: invalid format");
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return sendError(
        res,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        400,
        "VALIDATION_ERROR",
        `password: min ${MIN_PASSWORD_LENGTH} characters`
      );
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendError(res, "Email already registered", 409, "VALIDATION_ERROR", "email: already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    const token = generateToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    setTokenCookie(res, token, 7 * 24 * 60 * 60 * 1000);
    setTokenCookie(res, refreshToken, 30 * 24 * 60 * 60 * 1000);

    sendSuccess(res, { user: sanitizeUser(user), token }, "Registration successful", 201);
  } catch (error) {
    sendError(res, "Registration failed", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// POST /api/v1/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim()) {
      return sendError(res, "Email is required", 400, "VALIDATION_ERROR", "email: required");
    }
    if (!password) {
      return sendError(res, "Password is required", 400, "VALIDATION_ERROR", "password: required");
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !user.password) {
      return sendError(res, "Invalid email or password", 401, "UNAUTHORIZED", "Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, "Invalid email or password", 401, "UNAUTHORIZED", "Invalid credentials");
    }

    const token = generateToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    setTokenCookie(res, token, 7 * 24 * 60 * 60 * 1000);
    setTokenCookie(res, refreshToken, 30 * 24 * 60 * 60 * 1000);

    sendSuccess(res, { user: sanitizeUser(user), token }, "Login successful");
  } catch (error) {
    sendError(res, "Login failed", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// POST /api/v1/auth/google
router.post("/google", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return sendError(res, "Google token is required", 400, "VALIDATION_ERROR", "idToken: required");
    }

    // Verify Google token (production: use google-auth-library)
    // For development, decode the JWT payload without verification
    let payload: { sub: string; email: string; name?: string; picture?: string };
    try {
      const decoded = JSON.parse(
        Buffer.from(idToken.split(".")[1], "base64url").toString()
      );
      payload = {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      };
    } catch {
      return sendError(res, "Invalid Google token", 401, "UNAUTHORIZED", "Failed to decode token");
    }

    if (!payload.sub || !payload.email) {
      return sendError(res, "Invalid Google token payload", 401, "UNAUTHORIZED", "Missing required fields");
    }

    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.findOne({ email: payload.email.toLowerCase() });
      if (user) {
        user.googleId = payload.sub;
        if (payload.picture && !user.avatar) user.avatar = payload.picture;
        await user.save();
      } else {
        user = await User.create({
          name: payload.name || payload.email.split("@")[0],
          email: payload.email.toLowerCase(),
          avatar: payload.picture,
          googleId: payload.sub,
        });
      }
    }

    const token = generateToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    setTokenCookie(res, token, 7 * 24 * 60 * 60 * 1000);
    setTokenCookie(res, refreshToken, 30 * 24 * 60 * 60 * 1000);

    sendSuccess(res, { user: sanitizeUser(user), token }, "Google login successful");
  } catch (error) {
    sendError(res, "Google authentication failed", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// POST /api/v1/auth/logout
router.post("/logout", authenticate, (_req: Request, res: Response) => {
  res.clearCookie("token");
  res.clearCookie("refreshToken");
  sendSuccess(res, null, "Logged out successfully");
});

// GET /api/v1/auth/me
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!._id).select("name email role avatar createdAt");
    if (!user) {
      return sendError(res, "User not found", 404, "NOT_FOUND", "User not found");
    }
    sendSuccess(res, { user: sanitizeUser(user) }, "User fetched");
  } catch (error) {
    sendError(res, "Failed to fetch user", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// POST /api/v1/auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return sendError(res, "Refresh token required", 401, "UNAUTHORIZED", "No refresh token");
    }

    const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string; role: string };

    const user = await User.findById(decoded.userId);
    if (!user) {
      return sendError(res, "User not found", 401, "UNAUTHORIZED", "Invalid refresh token");
    }

    const newToken = generateToken(user._id.toString(), user.role);
    setTokenCookie(res, newToken, 7 * 24 * 60 * 60 * 1000);

    sendSuccess(res, { token: newToken }, "Token refreshed");
  } catch {
    sendError(res, "Invalid refresh token", 401, "UNAUTHORIZED", "Token expired or invalid");
  }
});

export default router;
