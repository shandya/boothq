import {
  createTicketSchema,
  finishTicketSchema,
  requeueTicketSchema,
  TicketStatus,
  ticketsQuerySchema,
  updateTicketSchema,
} from "@boothq/shared";
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import * as queueService from "../services/queue.service.js";
import { buildQueueSnapshot, toTicketDTO } from "../services/snapshot.service.js";
import { paramString, staffHandler } from "./util.js";

export const ticketsRouter = Router();

const KNOWN_STATUSES = new Set(Object.values(TicketStatus));

ticketsRouter.get(
  "/tickets",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const { search, status } = ticketsQuerySchema.parse(req.query);
    const day = await prisma.day.findFirst({ where: { status: "OPEN" } });
    if (!day) {
      res.json({ tickets: [] });
      return;
    }

    const statusFilter = status
      ?.split(",")
      .map((s) => s.trim())
      .filter((s): s is (typeof TicketStatus)[keyof typeof TicketStatus] => KNOWN_STATUSES.has(s as never));

    const tickets = await prisma.ticket.findMany({
      where: { dayId: day.id, ...(statusFilter?.length ? { status: { in: statusFilter } } : {}) },
      orderBy: { number: "asc" },
    });

    const digits = search?.replace(/\D/g, "") ?? "";
    const matches = search
      ? tickets.filter((t) => {
          const query = search.trim().toLowerCase();
          if (String(t.number) === query) return true;
          if (t.name.toLowerCase().includes(query)) return true;
          return digits.length > 0 && Boolean(t.phone?.replace(/\D/g, "").includes(digits));
        })
      : tickets;

    res.json({ tickets: matches.map((t) => toTicketDTO(t, { etaSec: null })) });
  }),
);

ticketsRouter.post(
  "/tickets",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    const input = createTicketSchema.parse(req.body);
    const { ticket } = await queueService.createTicket(req.role!, input);
    res.json({ ticket: toTicketDTO(ticket, { etaSec: null }), snapshot: await buildQueueSnapshot() });
  }),
);

ticketsRouter.patch(
  "/tickets/:id",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const input = updateTicketSchema.parse(req.body);
    const { ticket } = await queueService.updateTicket(req.role!, paramString(req.params.id), input);
    res.json({ ticket: toTicketDTO(ticket, { etaSec: null }), snapshot: await buildQueueSnapshot() });
  }),
);

ticketsRouter.delete(
  "/tickets/:id",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    await queueService.removeTicket(req.role!, paramString(req.params.id));
    res.json(await buildQueueSnapshot());
  }),
);

ticketsRouter.post(
  "/tickets/:id/start",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    await queueService.startTicket(req.role!, paramString(req.params.id));
    res.json(await buildQueueSnapshot());
  }),
);

ticketsRouter.post(
  "/tickets/:id/finish",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    const input = finishTicketSchema.parse(req.body);
    await queueService.finishTicket(req.role!, paramString(req.params.id), input);
    res.json(await buildQueueSnapshot());
  }),
);

ticketsRouter.post(
  "/tickets/:id/recall",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    await queueService.recallTicket(req.role!, paramString(req.params.id));
    res.json(await buildQueueSnapshot());
  }),
);

ticketsRouter.post(
  "/tickets/:id/no-show",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    await queueService.noShowTicket(req.role!, paramString(req.params.id));
    res.json(await buildQueueSnapshot());
  }),
);

ticketsRouter.post(
  "/tickets/:id/requeue",
  requireRole("ILLUSTRATOR"),
  staffHandler(async (req, res) => {
    const input = requeueTicketSchema.parse(req.body);
    await queueService.requeueTicket(req.role!, paramString(req.params.id), input);
    res.json(await buildQueueSnapshot());
  }),
);

ticketsRouter.post(
  "/tickets/:id/rotate-token",
  requireRole("ADMIN"),
  staffHandler(async (req, res) => {
    const { ticket } = await queueService.rotateTicketToken(req.role!, paramString(req.params.id));
    res.json({ ticket: toTicketDTO(ticket, { etaSec: null }), snapshot: await buildQueueSnapshot() });
  }),
);
