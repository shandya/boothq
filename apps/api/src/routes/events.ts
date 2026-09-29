import { renameEventSchema, startEventSchema } from "@boothq/shared";
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import * as eventService from "../services/event.service.js";
import { buildQueueSnapshot } from "../services/snapshot.service.js";
import { staffHandler } from "./util.js";

export const eventsRouter = Router();

eventsRouter.get(
  "/events",
  requireRole("ADMIN"),
  staffHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ events: await eventService.listEventsWithSummaries() });
  }),
);

eventsRouter.post(
  "/events",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const input = startEventSchema.parse(req.body);
    await eventService.startEvent(req.role!, input);
    res.set("Cache-Control", "no-store");
    res.json(await buildQueueSnapshot());
  }),
);

eventsRouter.patch(
  "/events/current",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const input = renameEventSchema.parse(req.body);
    await eventService.renameEvent(req.role!, input);
    res.set("Cache-Control", "no-store");
    res.json(await buildQueueSnapshot());
  }),
);

eventsRouter.post(
  "/events/current/end",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const { event } = await eventService.endEvent(req.role!);
    const summary = (await eventService.listEventsWithSummaries()).find((e) => e.id === event.id)?.summary;
    res.set("Cache-Control", "no-store");
    res.json({ summary, snapshot: await buildQueueSnapshot() });
  }),
);
