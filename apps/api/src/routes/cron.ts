import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { purgeExpiredPhones } from "../services/retention.service.js";
import { asyncHandler } from "./util.js";

export const cronRouter = Router();

function hasValidSecret(header: string | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called daily by Vercel Cron (apps/api/vercel.json), which sends
// `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET set, the endpoint
// refuses everyone rather than being open.
cronRouter.get(
  "/cron/retention",
  asyncHandler(async (req, res) => {
    if (!hasValidSecret(req.headers.authorization)) {
      throw new AppError(401, "UNAUTHENTICATED", "Invalid cron credentials.");
    }
    res.json({ phonesErased: await purgeExpiredPhones() });
  }),
);
