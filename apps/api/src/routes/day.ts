import { openDaySchema, patchDaySchema, pauseDaySchema } from "@boothq/shared";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { requireRole } from "../middleware/auth.js";
import * as queueService from "../services/queue.service.js";
import { buildQueueSnapshot, buildStats } from "../services/snapshot.service.js";
import { staffHandler } from "./util.js";

export const dayRouter = Router();

dayRouter.post(
  "/day/open",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const input = openDaySchema.parse(req.body);
    await queueService.openDay(req.role!, input);
    res.set("Cache-Control", "no-store");
    res.json(await buildQueueSnapshot());
  }),
);

dayRouter.post(
  "/day/close",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const { day } = await queueService.closeDay(req.role!);
    const summary = await buildStats(day.id);
    res.set("Cache-Control", "no-store");
    res.json({ summary, snapshot: await buildQueueSnapshot() });
  }),
);

dayRouter.patch(
  "/day",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    const input = patchDaySchema.parse(req.body);
    if (req.role !== "ADMIN") {
      const adminOnlyFields = Object.keys(input).filter((key) => key !== "acceptingTickets");
      if (adminOnlyFields.length > 0) {
        throw new AppError(403, "FORBIDDEN", "Illustrators may only toggle acceptingTickets.");
      }
    }
    await queueService.patchDay(req.role!, input);
    res.set("Cache-Control", "no-store");
    res.json(await buildQueueSnapshot());
  }),
);

dayRouter.post(
  "/day/pause",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    const input = pauseDaySchema.parse(req.body);
    await queueService.pauseDay(req.role!, input);
    res.set("Cache-Control", "no-store");
    res.json(await buildQueueSnapshot());
  }),
);

dayRouter.post(
  "/day/resume",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    await queueService.resumeDay(req.role!);
    res.set("Cache-Control", "no-store");
    res.json(await buildQueueSnapshot());
  }),
);
