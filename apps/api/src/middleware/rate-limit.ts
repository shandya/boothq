import type { Request, Response } from "express";
import { MINUTE, rateLimit } from "express-rate-limit";

function sendRateLimited(_req: Request, res: Response): void {
  res.status(429).json({
    error: { code: "RATE_LIMITED", message: "Too many requests. Try again shortly." },
  });
}

// docs/ARCHITECTURE.md → Rate limiting. The default in-memory store is
// per-instance on serverless, so limits are best-effort there; acceptable
// for v1.
export const loginRateLimit = rateLimit({
  windowMs: MINUTE,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimited,
});

// Keyed per token, not per IP: many customers share an IP on mobile carrier
// NAT or venue Wi-Fi.
export const publicTicketRateLimit = rateLimit({
  windowMs: MINUTE,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => String(req.params.token ?? "unknown"),
  handler: sendRateLimited,
});
