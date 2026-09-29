# API

> Draw-from-photo endpoints (built in Phase 8) are listed in `PHOTO_TICKETS.md`; Events endpoints (after MVP) in `EVENTS.md`.

Base path `/api`. JSON in, JSON out. All request schemas are zod schemas exported from `packages/shared/src/schemas.ts`; response types from `packages/shared/src/dto.ts`.

## Conventions

- Timestamps are ISO 8601 strings in UTC.
- Errors: `{ "error": { "code": "QUEUE_EMPTY", "message": "No one is waiting.", "details": { ... } } }`
- For `409` errors on staff queue actions, `details.snapshot` contains a fresh `QueueSnapshot` so the UI can resync without another request.
- Auth levels: **public**, **staff** (ILLUSTRATOR or ADMIN), **admin** (ADMIN only).

## Error codes

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | zod failed, invalid phone |
| 401 | `UNAUTHENTICATED` | no or expired session; wrong PIN returns `INVALID_PIN` |
| 403 | `FORBIDDEN` | illustrator calling an admin endpoint; bad Origin |
| 404 | `NOT_FOUND` | unknown ticket id or token (including rotated tokens) |
| 409 | `DAY_NOT_OPEN`, `DAY_ALREADY_OPEN`, `DAY_PAUSED`, `NOT_ACCEPTING`, `DUPLICATE_ACTIVE_TICKET`, `INVALID_TRANSITION`, `CURRENT_ACTIVE`, `QUEUE_EMPTY`, `STALE_STATE`, `NO_ACTIVE_EVENT`, `DAY_OPEN`, `NOTHING_TO_UNDO` | see `BUSINESS_LOGIC.md` |
| 503 | `STORAGE_UNAVAILABLE` | photo storage isn't configured (`BLOB_READ_WRITE_TOKEN` missing) |
| 429 | `RATE_LIMITED` | too many requests |

## Shared types

```ts
type EventDTO = {             // staff only; customers never see the Event
  id: string;
  name: string;
  status: 'ACTIVE' | 'ENDED';
  startedAt: string;
  endedAt: string | null;
  dayCount: number;           // Days opened so far, including one open now
};

type EventSummaryDTO = {
  dayCount: number;
  servedCount: number;
  noShowCount: number;
  cancelledCount: number;
  avgSessionSec: number;      // plain average over the Event's valid drawings; 0 when none
};

type UndoDTO = {              // staff only
  actionId: string;           // send back as `expectedActionId`
  action: 'CALL_NEXT' | 'START' | 'FINISH' | 'NO_SHOW';
  ticketNumber: number;
  expiresAt: string;          // 10 minutes after the action
};

type DaySummaryDTO = {
  ticketCount: number;
  servedCount: number;
  noShowCount: number;
  cancelledCount: number;
  avgSessionSec: number;      // plain average over the Day's valid drawings; 0 when none
  longestWaitSec: number | null; // created → called, over called tickets
};

type DayHistoryItemDTO = DayDTO & {   // staff only
  event: { id: string; name: string };
  dayNumber: number;          // 1-based position of the Day within its Event
  summary: DaySummaryDTO;
};

type DayDTO = {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  acceptingTickets: boolean;
  headsUpAhead: number;
  paused: boolean;
  pausedAt: string | null;    // when the break began; null unless paused
  pauseUntil: string | null;
  pauseReason: string | null;
};

type TicketDTO = {            // staff only
  id: string;
  number: number;
  name: string;
  phone: string | null;       // E.164
  phoneDisplay: string | null;// national format for display
  notes: string | null;
  status: TicketStatus;
  position: number | null;
  customerUrl: string;        // `${PUBLIC_WEB_URL}/t/${token}`
  createdAt: string;
  calledAt: string | null;
  callCount: number;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  cancelReason: CancelReason | null;
  etaSec: number | null;      // WAITING only
};

type StatsDTO = {
  servedCount: number;
  noShowCount: number;
  cancelledCount: number;
  waitingCount: number;
  avgSessionSec: number;           // measured from the last 10 drawings (close summary: that Day's own average)
  avgChangeoverSec: number;        // measured from the last 10 Finish → next Start gaps
  longestWaitSec: number | null;   // created → called, over called tickets
  projectedFinishAt: string | null; // null when queue empty
};

type QueueSnapshot = {
  serverTime: string;
  event: EventDTO | null;      // the ACTIVE Event; null = none running (staff only)
  day: DayDTO | null;          // null = booth closed, no open day
  current: TicketDTO | null;   // CALLED or SERVING
  waiting: TicketDTO[];        // ordered by position
  recent: TicketDTO[];         // last 10 DONE / NO_SHOW / CANCELLED, newest first
  stats: StatsDTO;
  undo: UndoDTO | null;        // the last action, if Undo can still reverse it
};

type PublicTicketView = {       // customer; NO phone, notes, ids, or other names
  serverTime: string;
  boothOpen: boolean;
  number: number;
  firstName: string;            // first word of name
  status: TicketStatus;
  cancelReason: CancelReason | null; // which of the three CANCELLED copy variants to show (docs/UI.md)
  calledAt: string | null;
  nowServing: { number: number; status: 'CALLED' | 'SERVING' } | null;
  peopleAhead: number | null;   // WAITING only: waitingAhead + (current ? 1 : 0)
  aheadNumbers: number[];       // WAITING only: first 2 WAITING ticket numbers ahead, for the line strip
  almostUp: boolean;            // WAITING and peopleAhead <= day.headsUpAhead (see BUSINESS_LOGIC.md)
  eta: {
    sec: number; lowSec: number; highSec: number;
    estimatedAt: string; confidence: 'low' | 'medium' | 'high';
    pausedUntimed: boolean;     // true = untimed break; etaSec excludes it
  } | null;                     // WAITING only
  avgSessionSec: number;
  pause: { active: boolean; until: string | null; reason: string | null };
};
```

## Health

`GET /api/health` → `{ ok: true }` (public)

## Auth

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/login` | public | `{ role: 'ADMIN' \| 'ILLUSTRATOR', pin: string }` | `{ role }` + sets `bq_session` cookie. `401 INVALID_PIN`. Rate limited 5/min/IP. |
| POST | `/api/auth/logout` | public | — | `{ ok: true }`, clears cookie |
| GET | `/api/auth/me` | staff | — | `{ role }` or 401 |

## Public (customer)

| Method | Path | Response |
|---|---|---|
| GET | `/api/public/tickets/:token` | `PublicTicketView`. 404 for unknown or rotated tokens. Rate limited 30/min/token. `Cache-Control: no-store`. |
| POST | `/api/public/tickets/:token/cancel` | `PublicTicketView`. Only from WAITING or CALLED, else `409 INVALID_TRANSITION`. Idempotent for already-cancelled tickets. |
| GET | `/api/public/now-serving` | `{ serverTime, boothOpen, paused, nowServing: number \| null, next: number[] /* up to 3 */, waitingCount }` for `/display` (P1) |

## Queue (staff)

All return `QueueSnapshot` unless stated.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/queue` | — | Polled every 5 s by staff pages |
| POST | `/api/queue/call-next` | `{ expectedNextId?: string }` | `CURRENT_ACTIVE`, `QUEUE_EMPTY`, `STALE_STATE`, `DAY_PAUSED` |
| POST | `/api/tickets/:id/start` | — | |
| POST | `/api/tickets/:id/finish` | `{ callNext?: boolean }` | |
| POST | `/api/tickets/:id/recall` | — | |
| POST | `/api/tickets/:id/no-show` | — | |
| POST | `/api/tickets/:id/requeue` | `{ afterCount?: number /* 0–50, default 2 */ }` | |
| POST | `/api/day/pause` | `{ minutes?: number /* 1–240; omit = untimed */, reason?: string }` | `CURRENT_ACTIVE` if someone is SERVING |
| POST | `/api/day/resume` | — | |
| PATCH | `/api/day` | `{ acceptingTickets?: boolean }` | Illustrator may only toggle `acceptingTickets` |
| POST | `/api/queue/undo` | `{ expectedActionId?: string }` | Reverts the Day's most recent Call next / Start / Finish / No-show (Finish & call next is undone as one) if it is under 10 min old. `QueueSnapshot`. `NOTHING_TO_UNDO`, `STALE_STATE` (the `expectedActionId` is no longer the latest action). See `BUSINESS_LOGIC.md` → Undo |
| POST | `/api/tickets` | `{ name: string /*1–60*/, phone: string, notes?: string /*≤280*/, force?: boolean }` | Illustrator or Admin (the one ticket-write route either role can call). Returns `{ ticket: TicketDTO, snapshot: QueueSnapshot }`, not bare `QueueSnapshot`. `DUPLICATE_ACTIVE_TICKET` returns `details.existing: TicketDTO` |

## Tickets and day (admin)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/day/open` | `{ headsUpAhead?: number /*0–10*/ }` | `QueueSnapshot`. `DAY_ALREADY_OPEN`, `NO_ACTIVE_EVENT` |
| POST | `/api/day/close` | — | `{ summary: StatsDTO, snapshot: QueueSnapshot }` |
| PATCH | `/api/day` | `{ acceptingTickets?, headsUpAhead? }` | `QueueSnapshot` |
| GET | `/api/tickets` | query `search?`, `status?` (comma list) | `{ tickets: TicketDTO[] }` for the open Day, search matches name (case-insensitive contains), phone digits, or exact number |
| PATCH | `/api/tickets/:id` | `{ name?, phone?, notes? }` | `{ ticket, snapshot }` |
| DELETE | `/api/tickets/:id` | — | `QueueSnapshot`. Soft remove (CANCELLED/ADMIN_REMOVED) |
| POST | `/api/queue/reorder` | `{ order: string[] }` (every WAITING ticket id, in the new order) | `QueueSnapshot`. `409 VALIDATION_ERROR` if the set of ids doesn't exactly match the current WAITING tickets (covers a stale drag against a concurrent change) |
| POST | `/api/tickets/:id/rotate-token` | — | `{ ticket, snapshot }` |
| GET | `/api/events` | — | `{ events: (EventDTO & { summary: EventSummaryDTO })[] }`, newest first |
| POST | `/api/events` | `{ name: string /*1–60*/ }` | Start a new Event, ending the current ACTIVE one. `QueueSnapshot`. `DAY_OPEN` |
| PATCH | `/api/events/current` | `{ name: string }` | Rename the ACTIVE Event (allowed while a Day is open). `QueueSnapshot`. `NO_ACTIVE_EVENT` |
| POST | `/api/events/current/end` | — | `{ summary: EventSummaryDTO, snapshot: QueueSnapshot }`. `DAY_OPEN`, `NO_ACTIVE_EVENT` |
| GET | `/api/days` | query `limit?` (1–200, default 100) | `{ days: DayHistoryItemDTO[] }`, newest first, including the Day that is open now |
| GET | `/api/days/:id/export.csv` | — | CSV download of one Day's tickets, one row per ticket in ticket-number order. `404 NOT_FOUND` for an unknown Day. See below |

Both `/api/days` routes are **admin only** because the history and export contain customers' phone numbers.

**CSV format**: UTF-8 with a leading BOM (so Excel reads accents and emoji correctly), CRLF line endings, RFC 4180 quoting. Columns: `Number, Name, Phone, Status, Notes, Cancel reason, Joined, Called, Started, Finished, Drawing (sec), Times called`. Timestamps are ISO 8601 in UTC. `Phone` is E.164 and is empty once the retention job has erased it. Free-text cells (name, notes) that start with `=`, `+`, `-`, `@`, tab or carriage return get a leading apostrophe so a spreadsheet can't run them as a formula (CSV injection); a real E.164 number is left as is. The filename is `boothq-{event}-day-{n}-{yyyy-mm-dd}.csv`.
