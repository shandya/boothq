import type { Request, Response } from "express";
import { MINUTE, rateLimit } from "express-rate-limit";

function sendRateLimited(_req: Request, res: Response): void {
  res.status(429).json({
    error: { code: "RATE_LIMITED", message: "Too many requests. Try again shortly." },
  });
}

// Integration tests log in and hit public endpoints far more than 5 or 30
// times a minute against the same address; the limiters themselves are
// exercised directly where needed instead.
function skipInTests(): boolean {
  return process.env.DISABLE_RATE_LIMIT === "true";
}

// docs/ARCHITECTURE.md → Rate limiting. The default in-memory store is
// per-instance on serverless, so limits are best-effort there; acceptable
// for v1.
export const loginRateLimit = rateLimit({
  windowMs: MINUTE,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: sendRateLimited,
});

// Keyed per token, not per IP: many customers share an IP on mobile carrier
// NAT or venue Wi-Fi.
export const publicTicketRateLimit = rateLimit({
  windowMs: MINUTE,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: (req: Request) => String(req.params.token ?? "unknown"),
  handler: sendRateLimited,
});
