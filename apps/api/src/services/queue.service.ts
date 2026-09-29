import type {
  CreateTicketInput,
  FinishTicketInput,
  OpenDayInput,
  PatchDayInput,
  PauseDayInput,
  ReorderQueueInput,
  RequeueTicketInput,
  Role,
  UndoInput,
} from "@boothq/shared";
import type { CallNextInput } from "@boothq/shared";
import { Prisma, type Day, type Ticket } from "@prisma/client";
import { nanoid } from "nanoid";
import { AppError } from "../lib/errors.js";
import { getDefaultCountry, normalizePhone } from "../lib/phone.js";
import { prisma } from "../lib/prisma.js";
import { logAction } from "./action-log.js";
import { lockEvents, renumberWaiting, withOpenDayLock } from "./day-lock.js";
import { dayPhotoPrefix, getPhotoStorage, photoPathname, PHOTO_MAX_BYTES, ticketPhotoPrefix } from "../lib/photo-storage.js";
import { toTicketDTO } from "./snapshot.service.js";
import { loadUndoable } from "./undo.js";

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

// Photo cleanup runs after the transaction commits; the rows are the source of
// truth, so a storage hiccup must not undo a state change. Anything left behind
// is swept by deletePrefix when the Day closes.
async function deletePhotosQuietly(pathnames: Array<string | null | undefined>): Promise<void> {
  const paths = pathnames.filter((p): p is string => Boolean(p));
  if (paths.length === 0) return;
  try {
    await getPhotoStorage().delete(paths);
  } catch (err) {
    console.error("photo cleanup failed", err);
  }
}

// Calls the next WAITING ticket. A FROM_PHOTO ticket has nobody to walk up, so
// it skips CALLED and starts drawing at once (docs/PHOTO_TICKETS.md).
async function callOrStart(
  tx: Prisma.TransactionClient,
  day: Day,
  next: Ticket,
  actorRole: Role,
  batchId?: string,
): Promise<Ticket> {
  const now = new Date();
  const updated = await tx.ticket.update({
    where: { id: next.id },
    data:
      next.mode === "FROM_PHOTO"
        ? { status: "SERVING", position: null, calledAt: now, startedAt: now, callCount: { increment: 1 } }
        : { status: "CALLED", position: null, calledAt: now, callCount: { increment: 1 } },
  });
  await logAction(tx, { dayId: day.id, ticketId: next.id, batchId, action: "CALL_NEXT", actorRole, before: next, after: updated });
  await renumberRemainingWaiting(tx, day.id);
  return updated;
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

  return callOrStart(tx, day, next, actorRole);
}

export async function openDay(actorRole: Role, input: OpenDayInput): Promise<{ day: Day }> {
  try {
    const day = await prisma.$transaction(async (tx) => {
      await lockEvents(tx);
      const event = await tx.event.findFirst({ where: { status: "ACTIVE" } });
      if (!event) throw new AppError(409, "NO_ACTIVE_EVENT", "Start an event before opening the booth.");

      const created = await tx.day.create({
        data: {
          eventId: event.id,
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
  const result = await closeDayWithinLock(actorRole);
  // READY tickets stay for pickup; their photos are already gone, and this
  // sweeps anything else under the Day, including never-confirmed uploads.
  try {
    await getPhotoStorage().deletePrefix(dayPhotoPrefix(result.day.id));
  } catch (err) {
    console.error("photo cleanup failed", err);
  }
  return result;
}

async function closeDayWithinLock(actorRole: Role): Promise<{ day: Day }> {
  return withOpenDayLock(async (tx, day) => {
    const serving = await tx.ticket.findFirst({ where: { dayId: day.id, status: "SERVING" } });
    if (serving) throw new AppError(409, "CURRENT_ACTIVE", "Someone is being served.");

    const toCancel = await tx.ticket.findMany({ where: { dayId: day.id, status: { in: ["WAITING", "CALLED"] } } });
    for (const ticket of toCancel) {
      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "CANCELLED",
          cancelReason: "DAY_CLOSED",
          cancelledAt: new Date(),
          position: null,
          ...(ticket.mode === "FROM_PHOTO" ? { photoPath: null } : {}),
        },
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
    // A photo ticket can be started out of order to fill a gap; walk-ups only from the front.
    if (!allowed && ticket.status === "WAITING" && (ticket.position === 1 || ticket.mode === "FROM_PHOTO")) {
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
  const photosToDelete: Array<string | null> = [];
  const result = await withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (ticket.status !== "SERVING") {
      throw new AppError(409, "INVALID_TRANSITION", "Only a ticket being served can be finished.");
    }

    const endedAt = new Date();
    const startedAt = ticket.startedAt ?? endedAt;
    const durationSec = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

    const fromPhoto = ticket.mode === "FROM_PHOTO";
    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: fromPhoto
        ? { status: "READY", endedAt, durationSec, readyAt: endedAt, photoPath: null }
        : { status: "DONE", endedAt, durationSec },
    });
    photosToDelete.push(ticket.photoPath);
    // Finish & call next is two log rows; Undo reverses them together.
    const batchId = input.callNext ? nanoid(12) : undefined;
    await logAction(tx, {
      dayId: day.id,
      ticketId: ticket.id,
      batchId,
      action: "FINISH",
      actorRole,
      before: ticket,
      after: updated,
    });

    let calledNext: Ticket | null = null;
    if (input.callNext) {
      const next = await tx.ticket.findFirst({ where: { dayId: day.id, status: "WAITING", position: 1 } });
      if (next) {
        calledNext = await callOrStart(tx, day, next, actorRole, batchId);
      }
    }

    return { ticket: updated, calledNext };
  });
  await deletePhotosQuietly(photosToDelete);
  return result;
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

  const result = await withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: found.id, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (ticket.status === "CANCELLED") return { ticket, photoPath: null };
    if (ticket.status !== "WAITING" && ticket.status !== "CALLED") {
      throw new AppError(409, "INVALID_TRANSITION", "This ticket can no longer be cancelled.");
    }

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: "CANCELLED", cancelReason: "CUSTOMER", cancelledAt: new Date(), position: null, photoPath: null },
    });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "CANCEL", actorRole: "CUSTOMER", before: ticket, after: updated });

    if (ticket.status === "WAITING") await renumberRemainingWaiting(tx, day.id);
    return { ticket: updated, photoPath: ticket.photoPath };
  });
  await deletePhotosQuietly([result.photoPath]);
  return { ticket: result.ticket };
}

export async function removeTicket(actorRole: Role, ticketId: string): Promise<{ ticket: Ticket }> {
  const result = await withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (
      ticket.status === "SERVING" ||
      ticket.status === "READY" ||
      ticket.status === "DONE" ||
      ticket.status === "CANCELLED"
    ) {
      throw new AppError(409, "INVALID_TRANSITION", "This ticket can't be removed right now.");
    }

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "CANCELLED",
        cancelReason: "ADMIN_REMOVED",
        cancelledAt: new Date(),
        position: null,
        photoPath: null,
      },
    });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "REMOVE", actorRole, before: ticket, after: updated });

    if (ticket.status === "WAITING") await renumberRemainingWaiting(tx, day.id);
    return { ticket: updated, photoPath: ticket.photoPath };
  });
  await deletePhotosQuietly([result.photoPath]);
  return { ticket: result.ticket };
}

// Photo tickets (docs/PHOTO_TICKETS.md). A photo on the ticket *is* the
// virtual-session switch: confirming one sets FROM_PHOTO, deleting it before
// drawing starts sets IN_PERSON.

const PHOTO_EDITABLE = new Set(["WAITING", "CALLED"]);

export async function createPhotoUploadToken(
  ticketId: string,
): Promise<{ pathname: string; clientToken: string }> {
  return withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (!PHOTO_EDITABLE.has(ticket.status)) {
      throw new AppError(409, "INVALID_TRANSITION", "A photo can only be added before drawing starts.");
    }
    const pathname = photoPathname(day.id, ticket.id, nanoid(8));
    const { clientToken } = await getPhotoStorage().createUploadToken(pathname, PHOTO_MAX_BYTES);
    return { pathname, clientToken };
  });
}

export async function confirmPhoto(actorRole: Role, ticketId: string, pathname: string): Promise<{ ticket: Ticket }> {
  const result = await withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (!PHOTO_EDITABLE.has(ticket.status)) {
      throw new AppError(409, "INVALID_TRANSITION", "A photo can only be added before drawing starts.");
    }
    // Only paths this ticket was issued a token for.
    if (!pathname.startsWith(ticketPhotoPrefix(day.id, ticket.id)) || !pathname.endsWith(".jpg") || pathname.includes("..")) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid photo path.");
    }
    if (!(await getPhotoStorage().exists(pathname))) {
      throw new AppError(400, "VALIDATION_ERROR", "The photo hasn't finished uploading.");
    }

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { mode: "FROM_PHOTO", photoPath: pathname, photoUploadedAt: new Date() },
    });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "ADD_PHOTO", actorRole, before: ticket, after: updated });
    return { ticket: updated, replaced: ticket.photoPath !== pathname ? ticket.photoPath : null };
  });
  await deletePhotosQuietly([result.replaced]);
  return { ticket: result.ticket };
}

export async function deletePhoto(actorRole: Role, ticketId: string): Promise<{ ticket: Ticket }> {
  const result = await withOpenDayLock(async (tx, day) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, dayId: day.id } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (!PHOTO_EDITABLE.has(ticket.status)) {
      throw new AppError(409, "INVALID_TRANSITION", "A photo can't be removed once drawing has started.");
    }
    if (!ticket.photoPath) throw new AppError(404, "NOT_FOUND", "This ticket has no photo.");

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { mode: "IN_PERSON", photoPath: null, photoUploadedAt: null },
    });
    await logAction(tx, { dayId: day.id, ticketId: ticket.id, action: "REMOVE_PHOTO", actorRole, before: ticket, after: updated });
    return { ticket: updated, removed: ticket.photoPath };
  });
  await deletePhotosQuietly([result.removed]);
  return { ticket: result.ticket };
}

export async function pickedUpTicket(actorRole: Role, ticketId: string): Promise<{ ticket: Ticket }> {
  // READY tickets survive close day, so this can't require an open Day.
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    if (ticket.status !== "READY") {
      throw new AppError(409, "INVALID_TRANSITION", "Only a ready portrait can be marked picked up.");
    }
    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: "DONE", pickedUpAt: new Date() },
    });
    await logAction(tx, { dayId: ticket.dayId, ticketId: ticket.id, action: "PICKED_UP", actorRole, before: ticket, after: updated });
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

type TicketJson = {
  status: Ticket["status"];
  position: number | null;
  calledAt: string | null;
  callCount: number;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  cancelledAt: string | null;
  cancelReason: Ticket["cancelReason"];
};

function asTicketJson(value: Prisma.JsonValue | null): TicketJson {
  if (value === null || typeof value !== "object" || Array.isArray(value) || typeof value.status !== "string") {
    throw new Error("ActionLog row has no ticket snapshot to restore");
  }
  return value as unknown as TicketJson;
}

const toDate = (iso: string | null): Date | null => (iso ? new Date(iso) : null);

// Puts one ticket back into the state its log row recorded in `before`.
async function revertTicketAction(
  tx: Prisma.TransactionClient,
  dayId: string,
  row: { ticketId: string | null; before: Prisma.JsonValue | null; after: Prisma.JsonValue | null },
): Promise<void> {
  const before = asTicketJson(row.before);
  const after = asTicketJson(row.after);

  const ticket = await tx.ticket.findFirst({ where: { id: row.ticketId ?? "", dayId } });
  if (!ticket || ticket.status !== after.status) {
    throw new AppError(409, "STALE_STATE", "The queue changed; please refresh.");
  }

  if (before.status === "CALLED" || before.status === "SERVING") {
    const other = await tx.ticket.findFirst({
      where: { dayId, status: { in: ["CALLED", "SERVING"] }, NOT: { id: ticket.id } },
    });
    if (other) throw new AppError(409, "CURRENT_ACTIVE", "Someone else is already current.");
  }

  await tx.ticket.update({
    where: { id: ticket.id },
    data: {
      status: before.status,
      position: before.position,
      calledAt: toDate(before.calledAt),
      callCount: before.callCount,
      startedAt: toDate(before.startedAt),
      endedAt: toDate(before.endedAt),
      durationSec: before.durationSec,
      cancelledAt: toDate(before.cancelledAt),
      cancelReason: before.cancelReason,
    },
  });

  if (before.status === "WAITING") {
    const others = await tx.ticket.findMany({
      where: { dayId, status: "WAITING", NOT: { id: ticket.id } },
      orderBy: { position: "asc" },
    });
    const index = Math.min(Math.max((before.position ?? 1) - 1, 0), others.length);
    const orderedIds = [...others.slice(0, index).map((t) => t.id), ticket.id, ...others.slice(index).map((t) => t.id)];
    await renumberWaiting(tx, dayId, orderedIds);
  }
}

// docs/BUSINESS_LOGIC.md → Undo.
export async function undoLastAction(actorRole: Role, input: UndoInput): Promise<{ undone: string }> {
  return withOpenDayLock(async (tx, day) => {
    const found = await loadUndoable(tx, day.id, new Date());
    if (!found) throw new AppError(409, "NOTHING_TO_UNDO", "There's nothing to undo.");
    if (input.expectedActionId && input.expectedActionId !== found.primary.id) {
      throw new AppError(409, "STALE_STATE", "The queue changed; please refresh.");
    }

    for (const row of [...found.rows].reverse()) await revertTicketAction(tx, day.id, row);

    await logAction(tx, {
      dayId: day.id,
      ticketId: found.primary.ticketId ?? undefined,
      action: "UNDO",
      actorRole,
      before: { actionId: found.primary.id, actions: found.rows.map((r) => r.action) },
    });
    return { undone: found.primary.action };
  });
}
