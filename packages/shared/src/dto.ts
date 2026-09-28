import type { CancelReason, TicketStatus } from "./enums.js";

export type DayDTO = {
  id: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  acceptingTickets: boolean;
  defaultDurationSec: number;
  changeoverSec: number;
  headsUpAhead: number;
  paused: boolean;
  pausedAt: string | null;
  pauseUntil: string | null;
  pauseReason: string | null;
};

export type TicketDTO = {
  // staff only
  id: string;
  number: number;
  name: string;
  phone: string | null; // E.164
  phoneDisplay: string | null; // national format for display
  notes: string | null;
  status: TicketStatus;
  position: number | null;
  customerUrl: string; // `${PUBLIC_WEB_URL}/t/${token}`
  createdAt: string;
  calledAt: string | null;
  callCount: number;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  cancelReason: CancelReason | null;
  etaSec: number | null; // WAITING only
};

export type StatsDTO = {
  servedCount: number;
  noShowCount: number;
  cancelledCount: number;
  waitingCount: number;
  avgSessionSec: number;
  longestWaitSec: number | null; // created → called, over called tickets
  projectedFinishAt: string | null; // null when queue empty
};

export type QueueSnapshot = {
  serverTime: string;
  day: DayDTO | null; // null = booth closed, no open day
  current: TicketDTO | null; // CALLED or SERVING
  waiting: TicketDTO[]; // ordered by position
  recent: TicketDTO[]; // last 10 DONE / NO_SHOW / CANCELLED, newest first
  stats: StatsDTO;
};

export type PublicTicketView = {
  // customer; NO phone, notes, ids, or other names
  serverTime: string;
  boothOpen: boolean;
  number: number;
  firstName: string; // first word of name
  status: TicketStatus;
  calledAt: string | null;
  nowServing: { number: number; status: "CALLED" | "SERVING" } | null;
  peopleAhead: number | null; // WAITING only: waitingAhead + (current ? 1 : 0)
  almostUp: boolean; // WAITING and peopleAhead <= day.headsUpAhead (see BUSINESS_LOGIC.md)
  eta: {
    sec: number;
    lowSec: number;
    highSec: number;
    estimatedAt: string;
    confidence: "low" | "medium" | "high";
  } | null; // WAITING only
  avgSessionSec: number;
  pause: { active: boolean; until: string | null; reason: string | null };
};
