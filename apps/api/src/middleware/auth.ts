import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "../lib/jwt.js";

declare global {
  // Augmenting Express's own Request type requires its namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      role?: SessionPayload["role"];
    }
  }
}

// requireRole('ILLUSTRATOR') accepts ILLUSTRATOR or ADMIN; requireRole('ADMIN')
// accepts ADMIN only (the ADMIN role can do everything ILLUSTRATOR can, see
// CLAUDE.md).
export function requireRole(minRole: SessionPayload["role"]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const session = token ? await verifySession(token) : null;

    if (!session) {
      next(new AppError(401, "UNAUTHENTICATED", "Sign in required."));
      return;
    }
    if (minRole === "ADMIN" && session.role !== "ADMIN") {
      next(new AppError(403, "FORBIDDEN", "Admin access required."));
      return;
    }

    req.role = session.role;
    next();
  };
}
