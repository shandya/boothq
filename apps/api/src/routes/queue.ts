import { callNextSchema, reorderQueueSchema, undoSchema } from "@boothq/shared";
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import * as queueService from "../services/queue.service.js";
import { buildQueueSnapshot } from "../services/snapshot.service.js";
import { staffHandler } from "./util.js";

export const queueRouter = Router();

queueRouter.get(
  "/queue",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await buildQueueSnapshot());
  }),
);

queueRouter.post(
  "/queue/call-next",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    const input = callNextSchema.parse(req.body);
    await queueService.callNext(req.role!, input);
    res.set("Cache-Control", "no-store");
    res.json(await buildQueueSnapshot());
  }),
);

queueRouter.post(
  "/queue/reorder",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const input = reorderQueueSchema.parse(req.body);
    await queueService.reorderQueue(req.role!, input);
    res.set("Cache-Control", "no-store");
    res.json(await buildQueueSnapshot());
  }),
);

queueRouter.post(
  "/queue/undo",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    const input = undoSchema.parse(req.body);
    await queueService.undoLastAction(req.role!, input);
    res.set("Cache-Control", "no-store");
    res.json(await buildQueueSnapshot());
  }),
);
