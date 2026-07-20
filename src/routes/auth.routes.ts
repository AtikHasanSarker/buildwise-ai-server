import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { sendSuccess, sendError } from "../utils/response";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { registerSchema, loginSchema, googleAuthSchema } from "../validation/schemas";

const router = Router();

const setCookie = (
  res: Response,
  name: string,
  value: string,
  maxAge: number
) => {
  res.cookie(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
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
router.post("/register", validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    console.log(`[REGISTER] Attempting to register: ${email}`);

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log(`[REGISTER] Email already registered: ${email}`);
      return sendError(res, "Email already registered", 409, "VALIDATION_ERROR", "email: already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    console.log(`[REGISTER] User created — _id: ${user._id}, email: ${user.email}, role: ${user.role}`);

    const token = generateToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

setCookie(res, "token", token, 7 * 24 * 60 * 60 * 1000);

setCookie(res, "refreshToken", refreshToken, 30 * 24 * 60 * 60 * 1000);

    sendSuccess(res, { user: sanitizeUser(user), token }, "Registration successful", 201);
  } catch (error) {
    console.error(`[REGISTER] Error:`, error);
    sendError(res, "Registration failed", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// POST /api/v1/auth/login
router.post("/login", validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

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

   setCookie(res, "token", token, 7 * 24 * 60 * 60 * 1000);

   setCookie(res, "refreshToken", refreshToken, 30 * 24 * 60 * 60 * 1000);

    sendSuccess(res, { user: sanitizeUser(user), token }, "Login successful");
  } catch (error) {
    sendError(res, "Login failed", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// POST /api/v1/auth/google
router.post("/google", validate(googleAuthSchema), async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    // Decode Google ID token payload (JWT base64url)
    let payload: { sub: string; email: string; name?: string; picture?: string };
    try {
      const decoded = JSON.parse(
        Buffer.from(idToken.split(".")[1], "base64url").toString()
      );
      if (!decoded.sub || !decoded.email) {
        return sendError(res, "Invalid Google token payload", 401, "UNAUTHORIZED", "Missing required fields");
      }
      payload = {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      };
    } catch {
      return sendError(res, "Invalid Google token", 401, "UNAUTHORIZED", "Failed to decode token");
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

   setCookie(res, "token", token, 7 * 24 * 60 * 60 * 1000);

   setCookie(res, "refreshToken", refreshToken, 30 * 24 * 60 * 60 * 1000);

    sendSuccess(res, { user: sanitizeUser(user), token }, "Google login successful");
  } catch (error) {
    sendError(res, "Google authentication failed", 500, "SERVER_ERROR", (error as Error).message);
  }
});

// POST /api/v1/auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });

  sendSuccess(res, null, "Logged out successfully");
});

// GET /api/v1/auth/me
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    console.log(`[AUTH/ME] Fetching user from DB — userId: ${req.user!._id}`);
    const user = await User.findById(req.user!._id).select("name email role avatar createdAt");
    if (!user) {
      console.log(`[AUTH/ME] User NOT found in DB — userId: ${req.user!._id}`);
      return sendError(res, "User not found", 404, "NOT_FOUND", "User not found");
    }
    console.log(`[AUTH/ME] User found — _id: ${user._id}, email: ${user.email}`);
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

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as { userId: string; role: string };

    const user = await User.findById(decoded.userId);
    if (!user) {
      return sendError(res, "User not found", 401, "UNAUTHORIZED", "Invalid refresh token");
    }

    const newToken = generateToken(user._id.toString(), user.role);
  setCookie(res, "token", newToken, 7 * 24 * 60 * 60 * 1000);

    sendSuccess(res, { token: newToken }, "Token refreshed");
  } catch {
    sendError(res, "Invalid refresh token", 401, "UNAUTHORIZED", "Token expired or invalid");
  }
});

// Token generators (moved here to avoid import circular dependency)
function generateToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

function generateRefreshToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET!, { expiresIn: "30d" });
}

export default router;
