import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// docs/ARCHITECTURE.md → Auth: mutations require Content-Type:
// application/json and an Origin header matching PUBLIC_WEB_URL (or absent,
// for same-origin server-to-server calls). Combined with sameSite=lax on the
// session cookie, this is sufficient CSRF protection here.
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const contentType = req.headers["content-type"];
  if (!contentType?.includes("application/json")) {
    next(new AppError(403, "FORBIDDEN", "Content-Type must be application/json."));
    return;
  }

  const origin = req.headers.origin;
  if (origin && origin !== process.env.PUBLIC_WEB_URL) {
    next(new AppError(403, "FORBIDDEN", "Origin not allowed."));
    return;
  }

  next();
}
