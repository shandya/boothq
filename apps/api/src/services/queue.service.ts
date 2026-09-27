import type {
  CreateTicketInput,
  FinishTicketInput,
  OpenDayInput,
  PatchDayInput,
  PauseDayInput,
  ReorderQueueInput,
  RequeueTicketInput,
  Role,
} from "@boothq/shared";
import type { CallNextInput } from "@boothq/shared";
import { Prisma, type Day, type Ticket } from "@prisma/client";
import { nanoid } from "nanoid";
import { AppError } from "../lib/errors.js";
import { getDefaultCountry, normalizePhone } from "../lib/phone.js";
import { prisma } from "../lib/prisma.js";
import { renumberWaiting, withOpenDayLock } from "./day-lock.js";
import { toTicketDTO } from "./snapshot.service.js";

async function logAction(
  tx: Prisma.TransactionClient,
  params: {
    dayId: string;
    ticketId?: string;
    action: string;
    actorRole: Role;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await tx.actionLog.create({
    data: {
      dayId: params.dayId,
      ticketId: params.ticketId,
      action: params.action,
      actorRole: params.actorRole,
      before: params.before === undefined ? Prisma.JsonNull : (params.before as Prisma.InputJsonValue),
      after: params.after === undefined ? Prisma.JsonNull : (params.after as Prisma.InputJsonValue),
    },
  });
}

async function renumberRemainingWaiting(tx: Prisma.TransactionClient, dayId: string): Promise<void> {
  const remaining = await tx.ticket.findMany({
    where: { dayId, status: "WAITING" },
    orderBy: { position: "asc" },
  });
  await renumberWaiting(
    tx,
    dayId,
    remaining.map((t) => t.id),
  );
}

async function callNextWithinLock(
  tx: Prisma.TransactionClient,
  day: Day,
  actorRole: Role,
  expectedNextId?: string,
): Promise<Ticket> {
  const current = await tx.ticket.findFirst({ where: { dayId: day.id, status: { in: ["CALLED", "SERVING"] } } });
  if (current) throw new AppError(409, "CURRENT_ACTIVE", "Someone is already current.");

  const next = await tx.ticket.findFirst({ where: { dayId: day.id, status: "WAITING", position: 1 } });
  if (!next) throw new AppError(409, "QUEUE_EMPTY", "No one is waiting.");

  if (expectedNextId && expectedNextId !== next.id) {
    throw new AppError(409, "STALE_STATE", "The queue changed; please refresh.");
  }

  const updated = await tx.ticket.update({
    where: { id: next.id },
    data: { status: "CALLED", position: null, calledAt: new Date(), callCount: { increment: 1 } },
  });
  await logAction(tx, { dayId: day.id, ticketId: next.id, action: "CALL_NEXT", actorRole, before: next, after: updated });
  await renumberRemainingWaiting(tx, day.id);
  return updated;
}

export async function openDay(actorRole: Role, input: OpenDayInput): Promise<{ day: Day }> {
  try {
    const day = await prisma.$transaction(async (tx) => {
      const created = await tx.day.create({
        data: {
          defaultDurationSec: input.defaultDurationSec ?? 600,
          changeoverSec: input.changeoverSec ?? 60,
          headsUpAhead: input.headsUpAhead ?? 3,
        },
      });
      await logAction(tx, { dayId: created.id, action: "OPEN_DAY", actorRole, after: created });
      return created;
    });
    return { day };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(409, "DAY_ALREADY_OPEN", "A day is already open.");
    }
    throw err;
  }
}

export async function closeDay(actorRole: Role): Promise<{ day: Day }> {
  return withOpenDayLock(async (tx, day) => {
    const serving = await tx.ticket.findFirst({ where: { dayId: day.id, status: "SERVING" } });
    if (serving) throw new AppError(409, "CURRENT_ACTIVE", "Someone is being served.");

    const toCancel = await tx.ticket.findMany({ where: { dayId: day.id, status: { in: ["WAITING", "CALLED"] } } });
    for (const ticket of toCancel) {
      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: "CANCELLED", cancelReason: "DAY_CLOSED", cancelledAt: new Date(), position: null },
      });
      await logAction(tx, {
        dayId: day.id,
        ticketId: ticket.id,
        action: "CLOSE_DAY_CANCEL",
        actorRole,
        before: ticket,
        after: updated,
      });
    }

    const closed = await tx.day.update({
      where: { id: day.id },
      data: { status: "CLOSED", closedAt: new Date(), pausedAt: null, pauseUntil: null, pauseReason: null },
    });
    await logAction(tx, { dayId: day.id, action: "CLOSE_DAY", actorRole, before: day, after: closed });
    return { day: closed };
  });
}

export async function createTicket(actorRole: Role, input: CreateTicketInput): Promise<{ ticket: Ticket; day: Day }> {
  return withOpenDayLock(async (tx, day) => {
    if (!day.acceptingTickets && !input.force) {
      throw new AppError(409, "NOT_ACCEPTING", "The booth isn't accepting new tickets right now.");
    }

    const normalized = normalizePhone(input.phone, getDefaultCountry());
    if (!normalized.valid) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid phone number.");
    }

    if (!input.force) {
      const existing = await tx.ticket.findFirst({
        where: { dayId: day.id, phone: normalized.e164, status: { in: ["WAITING", "CALLED", "SERVING"] } },
      });
      if (existing) {
        throw new AppError(409, "DUPLICATE_ACTIVE_TICKET", "This phone already has an active ticket.", {
          existing: toTicketDTO(existing, { etaSec: null }),
        });
      }
    }

    const maxPositionRow = await tx.ticket.aggregate({
      where: { dayId: day.id, status: "WAITING" },
      _max: { position: true },
    });
    const position = (maxPositionRow._max.position ?? 0) + 1;
    const number = day.nextNumber;

    const ticket = await tx.ticket.create({
      data: {
        dayId: day.id,
        number,
        name: input.name,
        phone: normalized.e164,
        notes: input.notes,
        token: nanoid(16),
        status: "WAITING",
        position,
      },
    });
    const updatedDay = await tx.day.update({ where: { id: day.id }, data: { nextNumber: number + 1 } });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "CREATE_TICKET", actorRole, after: ticket });

    return { ticket, day: updatedDay };
  });
}

export async function updateTicket(
  actorRole: Role,
  ticketId: string,
  input: { name?: string; phone?: string; notes?: string },
): Promise<{ ticket: Ticket }> {
  return withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");

    let phone = ticket.phone;
    if (input.phone !== undefined) {
      const normalized = normalizePhone(input.phone, getDefaultCountry());
      if (!normalized.valid) throw new AppError(400, "VALIDATION_ERROR", "Invalid phone number.");
      phone = normalized.e164;
    }

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "UPDATE_TICKET", actorRole, before: ticket, after: updated });
    return { ticket: updated };
  });
}

export async function callNext(actorRole: Role, input: CallNextInput): Promise<{ ticket: Ticket }> {
  return withOpenDayLock(async (tx, day) => {
    if (day.pausedAt) throw new AppError(409, "DAY_PAUSED", "The booth is on break.");
    const ticket = await callNextWithinLock(tx, day, actorRole, input.expectedNextId);
    return { ticket };
  });
}

export async function startTicket(actorRole: Role, ticketId: string): Promise<{ ticket: Ticket }> {
  return withOpenDayLock(async (tx, day) => {
    if (day.pausedAt) throw new AppError(409, "DAY_PAUSED", "The booth is on break.");

    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");

    let allowed = ticket.status === "CALLED";
    if (!allowed && ticket.status === "WAITING" && ticket.position === 1) {
      const current = await tx.ticket.findFirst({ where: { dayId: day.id, status: { in: ["CALLED", "SERVING"] } } });
      allowed = !current;
    }
    if (!allowed) {
      throw new AppError(409, "INVALID_TRANSITION", "Ticket can't be started from its current state.");
    }

    const wasWaiting = ticket.status === "WAITING";
    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: "SERVING", startedAt: new Date(), position: null },
    });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "START", actorRole, before: ticket, after: updated });

    if (wasWaiting) await renumberRemainingWaiting(tx, day.id);
    return { ticket: updated };
  });
}

export async function finishTicket(
  actorRole: Role,
  ticketId: string,
  input: FinishTicketInput,
): Promise<{ ticket: Ticket; calledNext: Ticket | null }> {
  return withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (ticket.status !== "SERVING") {
      throw new AppError(409, "INVALID_TRANSITION", "Only a ticket being served can be finished.");
    }

    const endedAt = new Date();
    const startedAt = ticket.startedAt ?? endedAt;
    const durationSec = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: "DONE", endedAt, durationSec },
    });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "FINISH", actorRole, before: ticket, after: updated });

    let calledNext: Ticket | null = null;
    if (input.callNext) {
      const next = await tx.ticket.findFirst({ where: { dayId: day.id, status: "WAITING", position: 1 } });
      if (next) {
        calledNext = await tx.ticket.update({
          where: { id: next.id },
          data: { status: "CALLED", position: null, calledAt: new Date(), callCount: { increment: 1 } },
        });
        await logAction(tx, {
          dayId: day.id,
          ticketId: next.id,
          action: "CALL_NEXT",
          actorRole,
          before: next,
          after: calledNext,
        });
        await renumberRemainingWaiting(tx, day.id);
      }
    }

    return { ticket: updated, calledNext };
  });
}

export async function recallTicket(actorRole: Role, ticketId: string): Promise<{ ticket: Ticket }> {
  return withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (ticket.status !== "CALLED") {
      throw new AppError(409, "INVALID_TRANSITION", "Only a called ticket can be recalled.");
    }

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { calledAt: new Date(), callCount: { increment: 1 } },
    });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "RECALL", actorRole, before: ticket, after: updated });
    return { ticket: updated };
  });
}

export async function noShowTicket(actorRole: Role, ticketId: string): Promise<{ ticket: Ticket }> {
  return withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (ticket.status !== "CALLED") {
      throw new AppError(409, "INVALID_TRANSITION", "Only a called ticket can be marked no-show.");
    }

    const updated = await tx.ticket.update({ where: { id: ticket.id }, data: { status: "NO_SHOW" } });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "NO_SHOW", actorRole, before: ticket, after: updated });
    return { ticket: updated };
  });
}

export async function requeueTicket(
  actorRole: Role,
  ticketId: string,
  input: RequeueTicketInput,
): Promise<{ ticket: Ticket }> {
  return withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (ticket.status !== "CALLED" && ticket.status !== "NO_SHOW") {
      throw new AppError(409, "INVALID_TRANSITION", "Only a called or no-show ticket can be requeued.");
    }

    const waiting = await tx.ticket.findMany({ where: { dayId: day.id, status: "WAITING" }, orderBy: { position: "asc" } });
    const afterCount = Math.min(Math.max(input.afterCount ?? 2, 0), waiting.length);

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: "WAITING", calledAt: null, position: afterCount + 1 },
    });

    const orderedIds = [
      ...waiting.slice(0, afterCount).map((t) => t.id),
      updated.id,
      ...waiting.slice(afterCount).map((t) => t.id),
    ];
    await renumberWaiting(tx, day.id, orderedIds);

    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "REQUEUE", actorRole, before: ticket, after: updated });
    return { ticket: updated };
  });
}

export async function cancelTicketByToken(token: string): Promise<{ ticket: Ticket }> {
  const found = await prisma.ticket.findUnique({ where: { token } });
  if (!found) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
  if (found.status === "CANCELLED") return { ticket: found };
  if (found.status !== "WAITING" && found.status !== "CALLED") {
    throw new AppError(409, "INVALID_TRANSITION", "This ticket can no longer be cancelled.");
  }

  return withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: found.id, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (ticket.status === "CANCELLED") return { ticket };
    if (ticket.status !== "WAITING" && ticket.status !== "CALLED") {
      throw new AppError(409, "INVALID_TRANSITION", "This ticket can no longer be cancelled.");
    }

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: "CANCELLED", cancelReason: "CUSTOMER", cancelledAt: new Date(), position: null },
    });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "CANCEL", actorRole: "CUSTOMER", before: ticket, after: updated });

    if (ticket.status === "WAITING") await renumberRemainingWaiting(tx, day.id);
    return { ticket: updated };
  });
}

export async function removeTicket(actorRole: Role, ticketId: string): Promise<{ ticket: Ticket }> {
  return withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (ticket.status === "SERVING" || ticket.status === "DONE") {
      throw new AppError(409, "INVALID_TRANSITION", "This ticket can't be removed right now.");
    }

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: "CANCELLED", cancelReason: "ADMIN_REMOVED", cancelledAt: new Date(), position: null },
    });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "REMOVE", actorRole, before: ticket, after: updated });

    if (ticket.status === "WAITING") await renumberRemainingWaiting(tx, day.id);
    return { ticket: updated };
  });
}

export async function rotateTicketToken(actorRole: Role, ticketId: string): Promise<{ ticket: Ticket }> {
  return withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");

    const updated = await tx.ticket.update({ where: { id: ticket.id }, data: { token: nanoid(16) } });
    await logAction(tx, {
      dayId: day.id,
      ticketId: ticket.id,
      action: "ROTATE_TOKEN",
      actorRole,
      before: { token: ticket.token },
      after: { token: updated.token },
    });
    return { ticket: updated };
  });
}

export async function pauseDay(actorRole: Role, input: PauseDayInput): Promise<{ day: Day }> {
  return withOpenDayLock(async (tx, day) => {
    const serving = await tx.ticket.findFirst({ where: { dayId: day.id, status: "SERVING" } });
    if (serving) throw new AppError(409, "CURRENT_ACTIVE", "Someone is being served.");

    const pauseUntil = input.minutes ? new Date(Date.now() + input.minutes * 60_000) : null;
    const updated = await tx.day.update({
      where: { id: day.id },
      data: { pausedAt: new Date(), pauseUntil, pauseReason: input.reason ?? null },
    });
    await logAction(tx, { dayId: day.id, action: "PAUSE", actorRole, before: day, after: updated });
    return { day: updated };
  });
}

export async function resumeDay(actorRole: Role): Promise<{ day: Day }> {
  return withOpenDayLock(async (tx, day) => {
    const updated = await tx.day.update({
      where: { id: day.id },
      data: { pausedAt: null, pauseUntil: null, pauseReason: null },
    });
    await logAction(tx, { dayId: day.id, action: "RESUME", actorRole, before: day, after: updated });
    return { day: updated };
  });
}

export async function patchDay(actorRole: Role, input: PatchDayInput): Promise<{ day: Day }> {
  return withOpenDayLock(async (tx, day) => {
    const updated = await tx.day.update({
      where: { id: day.id },
      data: {
        ...(input.acceptingTickets !== undefined ? { acceptingTickets: input.acceptingTickets } : {}),
        ...(input.defaultDurationSec !== undefined ? { defaultDurationSec: input.defaultDurationSec } : {}),
        ...(input.changeoverSec !== undefined ? { changeoverSec: input.changeoverSec } : {}),
        ...(input.headsUpAhead !== undefined ? { headsUpAhead: input.headsUpAhead } : {}),
      },
    });
    await logAction(tx, { dayId: day.id, action: "PATCH_DAY", actorRole, before: day, after: updated });
    return { day: updated };
  });
}

export async function reorderQueue(actorRole: Role, input: ReorderQueueInput): Promise<{ day: Day }> {
  return withOpenDayLock(async (tx, day) => {
    const waiting = await tx.ticket.findMany({ where: { dayId: day.id, status: "WAITING" } });
    const currentIds = new Set(waiting.map((t) => t.id));
    const givenIds = input.order;
    const sameSet =
      givenIds.length === currentIds.size &&
      new Set(givenIds).size === givenIds.length &&
      givenIds.every((id) => currentIds.has(id));

    if (!sameSet) {
      throw new AppError(
        409,
        "VALIDATION_ERROR",
        "The ticket list doesn't match the current queue; it may have changed.",
      );
    }

    await renumberWaiting(tx, day.id, givenIds);
    await logAction(tx, {
      dayId: day.id,
      action: "REORDER",
      actorRole,
      before: waiting.map((t) => ({ id: t.id, position: t.position })),
      after: givenIds,
    });
    return { day };
  });
}
