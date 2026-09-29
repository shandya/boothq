import {
  averageValidSessionSec,
  type EventDTO,
  type EventSummaryDTO,
  type RenameEventInput,
  type Role,
  type StartEventInput,
} from "@boothq/shared";
import type { Event } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { logAction } from "./action-log.js";
import { lockEvents } from "./day-lock.js";

export function toEventDTO(event: Event, dayCount: number): EventDTO {
  return {
    id: event.id,
    name: event.name,
    status: event.status,
    startedAt: event.startedAt.toISOString(),
    endedAt: event.endedAt?.toISOString() ?? null,
    dayCount,
  };
}

export async function getActiveEventDTO(): Promise<EventDTO | null> {
  const event = await prisma.event.findFirst({ where: { status: "ACTIVE" } });
  if (!event) return null;
  return toEventDTO(event, await prisma.day.count({ where: { eventId: event.id } }));
}

export async function listEventsWithSummaries(): Promise<(EventDTO & { summary: EventSummaryDTO })[]> {
  const events = await prisma.event.findMany({ orderBy: { startedAt: "desc" } });
  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const dayCounts = await prisma.day.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds } },
    _count: { _all: true },
  });
  const tickets = await prisma.ticket.findMany({
    where: { day: { eventId: { in: eventIds } } },
    select: { status: true, durationSec: true, day: { select: { eventId: true } } },
  });

  return events.map((event) => {
    const dayCount = dayCounts.find((d) => d.eventId === event.id)?._count._all ?? 0;
    const own = tickets.filter((t) => t.day.eventId === event.id);
    const done = own.filter((t) => t.status === "DONE");
    const summary: EventSummaryDTO = {
      dayCount,
      servedCount: done.length,
      noShowCount: own.filter((t) => t.status === "NO_SHOW").length,
      cancelledCount: own.filter((t) => t.status === "CANCELLED").length,
      avgSessionSec: averageValidSessionSec(done.flatMap((t) => (t.durationSec != null ? [t.durationSec] : []))),
    };
    return { ...toEventDTO(event, dayCount), summary };
  });
}

export async function startEvent(actorRole: Role, input: StartEventInput): Promise<{ event: Event }> {
  return prisma.$transaction(async (tx) => {
    await lockEvents(tx);
    if (await tx.day.findFirst({ where: { status: "OPEN" } })) {
      throw new AppError(409, "DAY_OPEN", "Close the booth first.");
    }

    const current = await tx.event.findFirst({ where: { status: "ACTIVE" } });
    const ended = current
      ? await tx.event.update({ where: { id: current.id }, data: { status: "ENDED", endedAt: new Date() } })
      : null;

    const event = await tx.event.create({ data: { name: input.name } });
    await logAction(tx, { eventId: event.id, action: "START_EVENT", actorRole, before: ended, after: event });
    return { event };
  });
}

export async function renameEvent(actorRole: Role, input: RenameEventInput): Promise<{ event: Event }> {
  return prisma.$transaction(async (tx) => {
    await lockEvents(tx);
    const current = await tx.event.findFirst({ where: { status: "ACTIVE" } });
    if (!current) throw new AppError(409, "NO_ACTIVE_EVENT", "No event is running.");

    const event = await tx.event.update({ where: { id: current.id }, data: { name: input.name } });
    await logAction(tx, { eventId: event.id, action: "RENAME_EVENT", actorRole, before: current, after: event });
    return { event };
  });
}

export async function endEvent(actorRole: Role): Promise<{ event: Event }> {
  const event = await prisma.$transaction(async (tx) => {
    await lockEvents(tx);
    if (await tx.day.findFirst({ where: { status: "OPEN" } })) {
      throw new AppError(409, "DAY_OPEN", "Close the booth first.");
    }

    const current = await tx.event.findFirst({ where: { status: "ACTIVE" } });
    if (!current) throw new AppError(409, "NO_ACTIVE_EVENT", "No event is running.");

    const ended = await tx.event.update({
      where: { id: current.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
    await logAction(tx, { eventId: ended.id, action: "END_EVENT", actorRole, before: current, after: ended });
    return ended;
  });
  return { event };
}
