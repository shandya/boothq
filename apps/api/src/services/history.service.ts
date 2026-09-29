import { averageValidSessionSec, type DayHistoryItemDTO, type DaySummaryDTO } from "@boothq/shared";
import type { Ticket } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { toCsv } from "../lib/csv.js";
import { prisma } from "../lib/prisma.js";
import { toDayDTO } from "./snapshot.service.js";

type SummaryTicket = Pick<Ticket, "status" | "createdAt" | "calledAt" | "durationSec">;

export function summarizeTickets(tickets: SummaryTicket[]): DaySummaryDTO {
  const done = tickets.filter((t) => t.status === "DONE" || t.status === "READY");
  const waits = tickets.flatMap((t) =>
    t.calledAt ? [Math.round((t.calledAt.getTime() - t.createdAt.getTime()) / 1000)] : [],
  );
  return {
    ticketCount: tickets.length,
    servedCount: done.length,
    noShowCount: tickets.filter((t) => t.status === "NO_SHOW").length,
    cancelledCount: tickets.filter((t) => t.status === "CANCELLED").length,
    avgSessionSec: averageValidSessionSec(done.flatMap((t) => (t.durationSec != null ? [t.durationSec] : []))),
    longestWaitSec: waits.length ? Math.max(...waits) : null,
  };
}

// 1-based position of each Day within its Event, oldest first.
async function loadDayNumbers(): Promise<Map<string, number>> {
  const days = await prisma.day.findMany({
    select: { id: true, eventId: true },
    orderBy: [{ openedAt: "asc" }, { id: "asc" }],
  });
  const counters = new Map<string, number>();
  const numbers = new Map<string, number>();
  for (const day of days) {
    const n = (counters.get(day.eventId) ?? 0) + 1;
    counters.set(day.eventId, n);
    numbers.set(day.id, n);
  }
  return numbers;
}

export async function listDayHistory(limit = 100): Promise<DayHistoryItemDTO[]> {
  const days = await prisma.day.findMany({
    orderBy: [{ openedAt: "desc" }, { id: "desc" }],
    take: limit,
    include: { event: { select: { id: true, name: true } } },
  });
  if (days.length === 0) return [];

  const [numbers, tickets] = await Promise.all([
    loadDayNumbers(),
    prisma.ticket.findMany({
      where: { dayId: { in: days.map((d) => d.id) } },
      select: { dayId: true, status: true, createdAt: true, calledAt: true, durationSec: true },
    }),
  ]);

  return days.map((day) => ({
    ...toDayDTO(day),
    event: day.event,
    dayNumber: numbers.get(day.id) ?? 1,
    summary: summarizeTickets(tickets.filter((t) => t.dayId === day.id)),
  }));
}

function slug(text: string): string {
  const ascii = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return ascii || "event";
}

const CSV_HEADER = [
  "Number",
  "Name",
  "Phone",
  "Status",
  "Notes",
  "Cancel reason",
  "Joined",
  "Called",
  "Started",
  "Finished",
  "Drawing (sec)",
  "Times called",
];

const iso = (date: Date | null): string => date?.toISOString() ?? "";

// One row per ticket, in ticket-number order. Timestamps are ISO 8601 (UTC).
export async function buildDayCsv(dayId: string): Promise<{ filename: string; body: string }> {
  const day = await prisma.day.findUnique({ where: { id: dayId }, include: { event: { select: { name: true } } } });
  if (!day) throw new AppError(404, "NOT_FOUND", "Day not found.");

  const [tickets, numbers] = await Promise.all([
    prisma.ticket.findMany({ where: { dayId }, orderBy: { number: "asc" } }),
    loadDayNumbers(),
  ]);

  const body = toCsv(
    CSV_HEADER,
    tickets.map((t) => [
      t.number,
      t.name,
      t.phone,
      t.status,
      t.notes,
      t.cancelReason,
      iso(t.createdAt),
      iso(t.calledAt),
      iso(t.startedAt),
      iso(t.endedAt),
      t.durationSec,
      t.callCount,
    ]),
  );

  const date = day.openedAt.toISOString().slice(0, 10);
  return { filename: `boothq-${slug(day.event.name)}-day-${numbers.get(day.id) ?? 1}-${date}.csv`, body };
}
