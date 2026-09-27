import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { attachSnapshotOn409 } from "../services/snapshot.service.js";

// req.params values are typed `string | string[] | undefined` (a route
// like `/foo/:bar*` can produce an array); every route here uses a single
// plain segment, so this narrows that back down to `string`.
export function paramString(value: string | string[] | undefined): string {
  if (typeof value !== "string") {
    throw new AppError(400, "VALIDATION_ERROR", "Missing or invalid path parameter.");
  }
  return value;
}

type Handler = (req: Request, res: Response) => Promise<void>;

export function asyncHandler(handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res);
    } catch (err) {
      next(err);
    }
  };
}

// For 409s on staff queue actions, attaches a fresh QueueSnapshot to
// error.details.snapshot so the UI can resync (docs/API.md → Conventions).
export function staffHandler(handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res);
    } catch (err) {
      next(await attachSnapshotOn409(err));
    }
  };
}
