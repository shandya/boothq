import type { CancelReason, TicketMode, TicketStatus } from "./enums.js";

export type EventDTO = {
  // staff only; customers never see the Event (CLAUDE.md → Naming)
  id: string;
  name: string;
  status: "ACTIVE" | "ENDED";
  startedAt: string;
  endedAt: string | null;
  dayCount: number; // Days opened so far, including one that is open now
};

export type EventSummaryDTO = {
  dayCount: number;
  servedCount: number;
  noShowCount: number;
  cancelledCount: number;
  avgSessionSec: number; // plain average over the Event's valid drawings; 0 when none
};

export type DayDTO = {
  id: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  acceptingTickets: boolean;
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
  mode: TicketMode;
  hasPhoto: boolean; // the image itself is fetched from GET /api/tickets/:id/photo
  position: number | null;
  customerUrl: string; // `${PUBLIC_WEB_URL}/t/${token}`
  createdAt: string;
  calledAt: string | null;
  callCount: number;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  cancelReason: CancelReason | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  etaSec: number | null; // WAITING only
};

export type StatsDTO = {
  servedCount: number; // DONE + READY (a finished portrait counts even before pickup)
  readyForPickupCount: number;
  noShowCount: number;
  cancelledCount: number;
  waitingCount: number;
  avgSessionSec: number; // measured from the last 10 drawings (BUSINESS_LOGIC.md §5)
  avgChangeoverSec: number; // measured from the last 10 Finish → next Start gaps
  longestWaitSec: number | null; // created → called, over called tickets
  projectedFinishAt: string | null; // null when queue empty
};

export type UndoDTO = {
  actionId: string; // send back as `expectedActionId` so a stale tap can't undo someone else's newer action
  action: "CALL_NEXT" | "START" | "FINISH" | "NO_SHOW";
  ticketNumber: number;
  expiresAt: string;
};

export type QueueSnapshot = {
  serverTime: string;
  event: EventDTO | null; // the ACTIVE Event; null = none running (staff only)
  day: DayDTO | null; // null = booth closed, no open day
  current: TicketDTO | null; // CALLED or SERVING
  waiting: TicketDTO[]; // ordered by position
  readyForPickup: TicketDTO[]; // READY, oldest first
  recent: TicketDTO[]; // last 10 DONE / NO_SHOW / CANCELLED, newest first
  stats: StatsDTO;
  undo: UndoDTO | null; // the last action, if Undo can still reverse it (staff only)
};

export type PublicTicketView = {
  // customer; NO phone, notes, ids, or other names
  serverTime: string;
  boothOpen: boolean;
  number: number;
  firstName: string; // first word of name
  status: TicketStatus;
  mode: TicketMode;
  cancelReason: CancelReason | null;
  calledAt: string | null;
  nowServing: { number: number; status: "CALLED" | "SERVING" } | null;
  peopleAhead: number | null; // WAITING only: waitingAhead + (current ? 1 : 0)
  aheadNumbers: number[]; // WAITING only: first 2 WAITING ticket numbers ahead, for the line strip
  almostUp: boolean; // WAITING and peopleAhead <= day.headsUpAhead (see BUSINESS_LOGIC.md)
  eta: {
    sec: number;
    lowSec: number;
    highSec: number;
    estimatedAt: string;
    confidence: "low" | "medium" | "high";
    pausedUntimed: boolean;
  } | null; // WAITING only
  readyEta: { sec: number; estimatedAt: string } | null; // FROM_PHOTO WAITING/SERVING: when the portrait is done
  avgSessionSec: number;
  pause: { active: boolean; until: string | null; reason: string | null };
};
