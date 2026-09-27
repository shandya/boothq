import { computeEta, type DayDTO, type PublicTicketView, type QueueSnapshot, type StatsDTO, type TicketDTO } from "@boothq/shared";
import type { Day, Ticket } from "@prisma/client";
import { AppError } from "../lib/errors.js";
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
  const waitingAhead = isWaiting
    ? dayTickets.filter((t) => t.status === "WAITING" && (t.position ?? 0) < (ticket.position ?? 0)).length
    : 0;
  const peopleAhead = isWaiting ? waitingAhead + (current ? 1 : 0) : null;

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
    calledAt: ticket.calledAt?.toISOString() ?? null,
    nowServing: current ? { number: current.number, status: current.status as "CALLED" | "SERVING" } : null,
    peopleAhead,
    almostUp,
    eta: eta
      ? {
          sec: eta.etaSec,
          lowSec: eta.lowSec,
          highSec: eta.highSec,
          estimatedAt: eta.estimatedAt.toISOString(),
          confidence: eta.confidence,
        }
      : null,
    avgSessionSec: averageSessionSecFor(day, completedDurationsSec, now),
    pause: { active: day.pausedAt != null, until: day.pauseUntil?.toISOString() ?? null, reason: day.pauseReason },
  };
}
