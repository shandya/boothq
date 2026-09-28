import { computeEta, type DayDTO, type PublicTicketView, type QueueSnapshot, type StatsDTO, type TicketDTO } from "@boothq/shared";
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

type CurrentInput = { status: "CALLED" | "SERVING"; startedAt: Date | null } | null;

function toCurrentInput(ticket: Ticket | null): CurrentInput {
  if (!ticket || (ticket.status !== "CALLED" && ticket.status !== "SERVING")) return null;
  return { status: ticket.status, startedAt: ticket.startedAt };
}

function averageSessionSecFor(day: Day, completedDurationsSec: number[], now: Date): number {
  return computeEta({
    now,
    defaultDurationSec: day.defaultDurationSec,
    changeoverSec: day.changeoverSec,
    completedDurationsSec,
    current: null,
    waitingAhead: 0,
    pause: null,
  }).avgSessionSec;
}

function completedDurationsOf(tickets: Ticket[]): number[] {
  return tickets
    .filter((t) => t.status === "DONE" && t.durationSec != null)
    .map((t) => t.durationSec as number);
}

export function toDayDTO(day: Day): DayDTO {
  return {
    id: day.id,
    status: day.status,
    openedAt: day.openedAt.toISOString(),
    closedAt: day.closedAt?.toISOString() ?? null,
    acceptingTickets: day.acceptingTickets,
    defaultDurationSec: day.defaultDurationSec,
    changeoverSec: day.changeoverSec,
    headsUpAhead: day.headsUpAhead,
    paused: day.pausedAt != null,
    pausedAt: day.pausedAt?.toISOString() ?? null,
    pauseUntil: day.pauseUntil?.toISOString() ?? null,
    pauseReason: day.pauseReason,
  };
}

export function toTicketDTO(ticket: Ticket, opts: { etaSec: number | null }): TicketDTO {
  const publicWebUrl = process.env.PUBLIC_WEB_URL ?? "";
  return {
    id: ticket.id,
    number: ticket.number,
    name: ticket.name,
    phone: ticket.phone,
    phoneDisplay: ticket.phone ? nationalDisplay(ticket.phone) : null,
    notes: ticket.notes,
    status: ticket.status,
    position: ticket.position,
    customerUrl: `${publicWebUrl}/t/${ticket.token}`,
    createdAt: ticket.createdAt.toISOString(),
    calledAt: ticket.calledAt?.toISOString() ?? null,
    callCount: ticket.callCount,
    startedAt: ticket.startedAt?.toISOString() ?? null,
    endedAt: ticket.endedAt?.toISOString() ?? null,
    durationSec: ticket.durationSec,
    cancelReason: ticket.cancelReason,
    etaSec: opts.etaSec,
  };
}

export async function findCurrentTicket(dayId: string): Promise<Ticket | null> {
  return prisma.ticket.findFirst({ where: { dayId, status: { in: ["CALLED", "SERVING"] } } });
}

export async function buildStats(dayId: string, now: Date = new Date()): Promise<StatsDTO> {
  const day = await prisma.day.findUniqueOrThrow({ where: { id: dayId } });
  const tickets = await prisma.ticket.findMany({ where: { dayId } });

  const servedCount = tickets.filter((t) => t.status === "DONE").length;
  const noShowCount = tickets.filter((t) => t.status === "NO_SHOW").length;
  const cancelledCount = tickets.filter((t) => t.status === "CANCELLED").length;
  const waitingCount = tickets.filter((t) => t.status === "WAITING").length;
  const completedDurationsSec = completedDurationsOf(tickets);
  const avgSessionSec = averageSessionSecFor(day, completedDurationsSec, now);

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
      defaultDurationSec: day.defaultDurationSec,
      changeoverSec: day.changeoverSec,
      completedDurationsSec,
      current: toCurrentInput(current),
      waitingAhead: waitingCount,
      pause: day.pausedAt ? { until: day.pauseUntil } : null,
    });
    projectedFinishAt = eta.estimatedAt.toISOString();
  }

  return { servedCount, noShowCount, cancelledCount, waitingCount, avgSessionSec, longestWaitSec, projectedFinishAt };
}

export async function buildQueueSnapshot(now: Date = new Date()): Promise<QueueSnapshot> {
  const day = await prisma.day.findFirst({ where: { status: "OPEN" } });
  if (!day) {
    return {
      serverTime: now.toISOString(),
      day: null,
      current: null,
      waiting: [],
      recent: [],
      stats: {
        servedCount: 0,
        noShowCount: 0,
        cancelledCount: 0,
        waitingCount: 0,
        avgSessionSec: 0,
        longestWaitSec: null,
        projectedFinishAt: null,
      },
    };
  }

  const tickets = await prisma.ticket.findMany({ where: { dayId: day.id } });
  const current = tickets.find((t) => t.status === "CALLED" || t.status === "SERVING") ?? null;
  const waiting = tickets
    .filter((t) => t.status === "WAITING")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const recent = tickets
    .filter((t) => t.status === "DONE" || t.status === "NO_SHOW" || t.status === "CANCELLED")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10);

  const completedDurationsSec = completedDurationsOf(tickets);
  const currentInput = toCurrentInput(current);
  const pauseInput = day.pausedAt ? { until: day.pauseUntil } : null;

  const waitingDTOs = waiting.map((ticket, index) => {
    const eta = computeEta({
      now,
      defaultDurationSec: day.defaultDurationSec,
      changeoverSec: day.changeoverSec,
      completedDurationsSec,
      current: currentInput,
      waitingAhead: index,
      pause: pauseInput,
    });
    return toTicketDTO(ticket, { etaSec: eta.etaSec });
  });

  return {
    serverTime: now.toISOString(),
    day: toDayDTO(day),
    current: current ? toTicketDTO(current, { etaSec: null }) : null,
    waiting: waitingDTOs,
    recent: recent.map((t) => toTicketDTO(t, { etaSec: null })),
    stats: await buildStats(day.id, now),
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
  const completedDurationsSec = completedDurationsOf(dayTickets);
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
        defaultDurationSec: day.defaultDurationSec,
        changeoverSec: day.changeoverSec,
        completedDurationsSec,
        current: currentInput,
        waitingAhead,
        pause: pauseInput,
      })
    : null;

  const almostUp = isWaiting && day.headsUpAhead > 0 && (peopleAhead ?? Number.POSITIVE_INFINITY) <= day.headsUpAhead;

  return {
    serverTime: now.toISOString(),
    boothOpen: day.status === "OPEN",
    number: ticket.number,
    firstName: ticket.name.split(/\s+/)[0] ?? ticket.name,
    status: ticket.status,
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
    avgSessionSec: averageSessionSecFor(day, completedDurationsSec, now),
    pause: { active: day.pausedAt != null, until: day.pauseUntil?.toISOString() ?? null, reason: day.pauseReason },
  };
}
