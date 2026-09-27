import { loginSchema } from "@boothq/shared";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { SESSION_COOKIE, signSession, type SessionPayload } from "../lib/jwt.js";
import { requireRole } from "../middleware/auth.js";
import { loginRateLimit } from "../middleware/rate-limit.js";

export const authRouter = Router();

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function pinHashFor(role: SessionPayload["role"]): string | undefined {
  return role === "ADMIN" ? process.env.ADMIN_PIN_HASH : process.env.ILLUSTRATOR_PIN_HASH;
}

authRouter.post("/auth/login", loginRateLimit, async (req, res, next) => {
  try {
    const { role, pin } = loginSchema.parse(req.body);
    const hash = pinHashFor(role);
    const valid = hash ? await bcrypt.compare(pin, hash) : false;
    if (!valid) {
      throw new AppError(401, "INVALID_PIN", "Wrong PIN.");
    }

    const token = await signSession({ role });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS,
    });
    res.json({ role });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/auth/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/auth/me", requireRole("ILLUSTRATOR"), (req, res) => {
  res.json({ role: req.role });
});
