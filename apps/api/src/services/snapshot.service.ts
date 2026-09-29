import {
  computeEta,
  type DayDTO,
  type PublicTicketView,
  type QueueSnapshot,
  type RecentHistory,
  recentHistory,
  type StatsDTO,
  type TicketDTO,
} from "@boothq/shared";
import type { Day, Ticket } from "@prisma/client";
import { AppError } from "../lib/errors.js";

// For 409 errors on staff queue actions, details.snapshot carries a fresh
// QueueSnapshot so the UI can resync without another request
// (docs/API.md → Conventions).
export async function attachSnapshotOn409(err: unknown): Promise<unknown> {
  if (err instanceof AppError && err.status === 409) {
    const snapshot = await buildQueueSnapshot();
    return new AppError(err.status, err.code, err.message, { ...err.details, snapshot });
  }
  return err;
}
import { nationalDisplay } from "../lib/phone.js";
import { prisma } from "../lib/prisma.js";
import { publicWebOrigin } from "../lib/public-web-url.js";
import { getActiveEventDTO } from "./event.service.js";
import { loadUndoable, toUndoDTO } from "./undo.js";

type CurrentInput = { status: "CALLED" | "SERVING"; startedAt: Date | null } | null;

function toCurrentInput(ticket: Ticket | null): CurrentInput {
  if (!ticket || (ticket.status !== "CALLED" && ticket.status !== "SERVING")) return null;
  return { status: ticket.status, startedAt: ticket.startedAt };
}

const HISTORY_TICKET_LIMIT = 30; // enough to find 10 valid drawings and 10 gaps

// The single place that decides which tickets feed the measured drawing time
// and time between customers: those from the Days of one Event, so a new venue
// starts from the defaults (docs/EVENTS.md → ETA history scope).
export async function loadRecentHistory(eventId: string): Promise<RecentHistory> {
  const tickets = await prisma.ticket.findMany({
    where: { startedAt: { not: null }, day: { eventId } },
    orderBy: { startedAt: "desc" },
    take: HISTORY_TICKET_LIMIT,
    select: { dayId: true, status: true, mode: true, createdAt: true, startedAt: true, endedAt: true, durationSec: true },
  });
  const oldest = tickets.at(-1)?.startedAt;
  const pauses = oldest
    ? await prisma.actionLog.findMany({
        where: { action: "PAUSE", createdAt: { gte: oldest }, day: { eventId } },
        select: { dayId: true, createdAt: true },
      })
    : [];
  return recentHistory({
    tickets,
    pauses: pauses.flatMap((p) => (p.dayId ? [{ dayId: p.dayId, at: p.createdAt }] : [])),
  });
}

function measuredAverages(history: RecentHistory, now: Date): { avgSessionSec: number; avgChangeoverSec: number } {
  const { avgSessionSec, avgChangeoverSec } = computeEta({
    now,
    recentSessionsSec: history.sessionsSec,
    recentChangeoversSec: history.changeoversSec,
    current: null,
    waitingAhead: 0,
    pause: null,
  });
  return { avgSessionSec, avgChangeoverSec };
}

export function toDayDTO(day: Day): DayDTO {
  return {
    id: day.id,
    status: day.status,
    openedAt: day.openedAt.toISOString(),
    closedAt: day.closedAt?.toISOString() ?? null,
    acceptingTickets: day.acceptingTickets,
    headsUpAhead: day.headsUpAhead,
    paused: day.pausedAt != null,
    pausedAt: day.pausedAt?.toISOString() ?? null,
    pauseUntil: day.pauseUntil?.toISOString() ?? null,
    pauseReason: day.pauseReason,
  };
}

export function toTicketDTO(ticket: Ticket, opts: { etaSec: number | null }): TicketDTO {
  const publicWebUrl = publicWebOrigin();
  return {
    id: ticket.id,
    number: ticket.number,
    name: ticket.name,
    phone: ticket.phone,
    phoneDisplay: ticket.phone ? nationalDisplay(ticket.phone) : null,
    notes: ticket.notes,
    status: ticket.status,
    mode: ticket.mode,
    hasPhoto: ticket.photoPath != null,
    position: ticket.position,
    customerUrl: `${publicWebUrl}/t/${ticket.token}`,
    createdAt: ticket.createdAt.toISOString(),
    calledAt: ticket.calledAt?.toISOString() ?? null,
    callCount: ticket.callCount,
    startedAt: ticket.startedAt?.toISOString() ?? null,
    endedAt: ticket.endedAt?.toISOString() ?? null,
    durationSec: ticket.durationSec,
    cancelReason: ticket.cancelReason,
    readyAt: ticket.readyAt?.toISOString() ?? null,
    pickedUpAt: ticket.pickedUpAt?.toISOString() ?? null,
    etaSec: opts.etaSec,
  };
}

export async function findCurrentTicket(dayId: string): Promise<Ticket | null> {
  return prisma.ticket.findFirst({ where: { dayId, status: { in: ["CALLED", "SERVING"] } } });
}

export async function buildStats(
  dayId: string,
  now: Date = new Date(),
  history?: RecentHistory,
): Promise<StatsDTO> {
  const day = await prisma.day.findUniqueOrThrow({ where: { id: dayId } });
  const tickets = await prisma.ticket.findMany({ where: { dayId } });
  const recent = history ?? (await loadRecentHistory(day.eventId));
  return statsFor(day, tickets, recent, now);
}

function statsFor(day: Day, tickets: Ticket[], recent: RecentHistory, now: Date): StatsDTO {
  const servedCount = tickets.filter((t) => t.status === "DONE" || t.status === "READY").length;
  const readyForPickupCount = tickets.filter((t) => t.status === "READY").length;
  const noShowCount = tickets.filter((t) => t.status === "NO_SHOW").length;
  const cancelledCount = tickets.filter((t) => t.status === "CANCELLED").length;
  const waitingCount = tickets.filter((t) => t.status === "WAITING").length;
  const { avgSessionSec, avgChangeoverSec } = measuredAverages(recent, now);

  const calledTickets = tickets.filter((t) => t.calledAt != null);
  const longestWaitSec = calledTickets.length
    ? Math.max(
        ...calledTickets.map((t) => Math.round(((t.calledAt as Date).getTime() - t.createdAt.getTime()) / 1000)),
      )
    : null;

  const current = tickets.find((t) => t.status === "CALLED" || t.status === "SERVING") ?? null;
  let projectedFinishAt: string | null = null;
  if (current || waitingCount > 0) {
    const eta = computeEta({
      now,
      recentSessionsSec: recent.sessionsSec,
      recentChangeoversSec: recent.changeoversSec,
      current: toCurrentInput(current),
      waitingAhead: waitingCount,
      pause: day.pausedAt ? { until: day.pauseUntil } : null,
    });
    projectedFinishAt = eta.estimatedAt.toISOString();
  }

  return {
    servedCount,
    readyForPickupCount,
    noShowCount,
    cancelledCount,
    waitingCount,
    avgSessionSec,
    avgChangeoverSec,
    longestWaitSec,
    projectedFinishAt,
  };
}

// Close summary: the average describes this Day alone, not the rolling window.
export async function buildDaySummary(dayId: string): Promise<StatsDTO> {
  const stats = await buildStats(dayId);
  const durations = (
    await prisma.ticket.findMany({ where: { dayId, status: { in: ["DONE", "READY"] } }, select: { durationSec: true } })
  ).flatMap((t) => (t.durationSec != null && t.durationSec >= 60 ? [t.durationSec] : []));
  const avgSessionSec = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  return { ...stats, avgSessionSec };
}

async function currentUndo(dayId: string, now: Date) {
  const undoable = await loadUndoable(prisma, dayId, now);
  return undoable ? toUndoDTO(undoable) : null;
}

export async function buildQueueSnapshot(now: Date = new Date()): Promise<QueueSnapshot> {
  const day = await prisma.day.findFirst({ where: { status: "OPEN" } });
  const event = await getActiveEventDTO();
  if (!day) {
    return {
      serverTime: now.toISOString(),
      event,
      day: null,
      current: null,
      waiting: [],
      readyForPickup: [],
      recent: [],
      stats: {
        servedCount: 0,
        readyForPickupCount: 0,
        noShowCount: 0,
        cancelledCount: 0,
        waitingCount: 0,
        avgSessionSec: 0,
        avgChangeoverSec: 0,
        longestWaitSec: null,
        projectedFinishAt: null,
      },
      undo: null,
    };
  }

  const tickets = await prisma.ticket.findMany({ where: { dayId: day.id } });
  const current = tickets.find((t) => t.status === "CALLED" || t.status === "SERVING") ?? null;
  const waiting = tickets
    .filter((t) => t.status === "WAITING")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const readyForPickup = tickets
    .filter((t) => t.status === "READY")
    .sort((a, b) => (a.readyAt?.getTime() ?? 0) - (b.readyAt?.getTime() ?? 0));
  const recent = tickets
    .filter((t) => t.status === "DONE" || t.status === "NO_SHOW" || t.status === "CANCELLED")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10);

  const history = await loadRecentHistory(day.eventId);
  const currentInput = toCurrentInput(current);
  const pauseInput = day.pausedAt ? { until: day.pauseUntil } : null;

  const waitingDTOs = waiting.map((ticket, index) => {
    const eta = computeEta({
      now,
      recentSessionsSec: history.sessionsSec,
      recentChangeoversSec: history.changeoversSec,
      current: currentInput,
      waitingAhead: index,
      pause: pauseInput,
    });
    return toTicketDTO(ticket, { etaSec: eta.etaSec });
  });

  return {
    serverTime: now.toISOString(),
    event,
    day: toDayDTO(day),
    current: current ? toTicketDTO(current, { etaSec: null }) : null,
    waiting: waitingDTOs,
    readyForPickup: readyForPickup.map((t) => toTicketDTO(t, { etaSec: null })),
    recent: recent.map((t) => toTicketDTO(t, { etaSec: null })),
    stats: statsFor(day, tickets, history, now),
    undo: await currentUndo(day.id, now),
  };
}

export type NowServingView = {
  serverTime: string;
  boothOpen: boolean;
  paused: boolean;
  nowServing: number | null;
  next: number[]; // up to 3
  waitingCount: number;
};

export async function buildNowServingView(now: Date = new Date()): Promise<NowServingView> {
  const day = await prisma.day.findFirst({ where: { status: "OPEN" } });
  if (!day) {
    return { serverTime: now.toISOString(), boothOpen: false, paused: false, nowServing: null, next: [], waitingCount: 0 };
  }

  const tickets = await prisma.ticket.findMany({ where: { dayId: day.id } });
  const current = tickets.find((t) => t.status === "CALLED" || t.status === "SERVING") ?? null;
  const waiting = tickets
    .filter((t) => t.status === "WAITING")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return {
    serverTime: now.toISOString(),
    boothOpen: true,
    paused: day.pausedAt != null,
    nowServing: current?.number ?? null,
    next: waiting.slice(0, 3).map((t) => t.number),
    waitingCount: waiting.length,
  };
}

export async function buildPublicTicketView(token: string, now: Date = new Date()): Promise<PublicTicketView> {
  const ticket = await prisma.ticket.findUnique({ where: { token }, include: { day: true } });
  if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");

  const { day } = ticket;
  const dayTickets = await prisma.ticket.findMany({ where: { dayId: day.id } });
  const history = await loadRecentHistory(day.eventId);
  const current = dayTickets.find((t) => t.status === "CALLED" || t.status === "SERVING") ?? null;
  const currentInput = toCurrentInput(current);
  const pauseInput = day.pausedAt ? { until: day.pauseUntil } : null;

  const isWaiting = ticket.status === "WAITING";
  const ticketsAhead = isWaiting
    ? dayTickets
        .filter((t) => t.status === "WAITING" && (t.position ?? 0) < (ticket.position ?? 0))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : [];
  const waitingAhead = ticketsAhead.length;
  const peopleAhead = isWaiting ? waitingAhead + (current ? 1 : 0) : null;
  const aheadNumbers = ticketsAhead.slice(0, 2).map((t) => t.number);

  const eta = isWaiting
    ? computeEta({
        now,
        recentSessionsSec: history.sessionsSec,
        recentChangeoversSec: history.changeoversSec,
        current: currentInput,
        waitingAhead,
        pause: pauseInput,
      })
    : null;

  const fromPhoto = ticket.mode === "FROM_PHOTO";
  const avgSessionSec = measuredAverages(history, now).avgSessionSec;
  // FROM_PHOTO customers care about when the portrait is done, not when they're called.
  let readyEta: PublicTicketView["readyEta"] = null;
  if (fromPhoto && eta) {
    const sec = eta.etaSec + avgSessionSec;
    readyEta = { sec, estimatedAt: new Date(now.getTime() + sec * 1000).toISOString() };
  } else if (fromPhoto && ticket.status === "SERVING") {
    const elapsedSec = ticket.startedAt ? (now.getTime() - ticket.startedAt.getTime()) / 1000 : 0;
    const sec = Math.round(Math.max(avgSessionSec - elapsedSec, 60));
    readyEta = { sec, estimatedAt: new Date(now.getTime() + sec * 1000).toISOString() };
  }

  const almostUp = !fromPhoto && isWaiting && day.headsUpAhead > 0 && (peopleAhead ?? Number.POSITIVE_INFINITY) <= day.headsUpAhead;

  return {
    serverTime: now.toISOString(),
    boothOpen: day.status === "OPEN",
    number: ticket.number,
    firstName: ticket.name.split(/\s+/)[0] ?? ticket.name,
    status: ticket.status,
    mode: ticket.mode,
    cancelReason: ticket.cancelReason,
    calledAt: ticket.calledAt?.toISOString() ?? null,
    nowServing: current ? { number: current.number, status: current.status as "CALLED" | "SERVING" } : null,
    peopleAhead,
    aheadNumbers,
    almostUp,
    eta: eta
      ? {
          sec: eta.etaSec,
          lowSec: eta.lowSec,
          highSec: eta.highSec,
          estimatedAt: eta.estimatedAt.toISOString(),
          confidence: eta.confidence,
          pausedUntimed: eta.pausedUntimed,
        }
      : null,
    readyEta,
    avgSessionSec,
    pause: { active: day.pausedAt != null, until: day.pauseUntil?.toISOString() ?? null, reason: day.pauseReason },
  };
}
