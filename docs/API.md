# API

> Draw-from-photo endpoints (after MVP) are listed in `PHOTO_TICKETS.md`.

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
| 409 | `DAY_NOT_OPEN`, `DAY_ALREADY_OPEN`, `DAY_PAUSED`, `NOT_ACCEPTING`, `DUPLICATE_ACTIVE_TICKET`, `INVALID_TRANSITION`, `CURRENT_ACTIVE`, `QUEUE_EMPTY`, `STALE_STATE` | see `BUSINESS_LOGIC.md` |
| 429 | `RATE_LIMITED` | too many requests |

## Shared types

```ts
type DayDTO = {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  acceptingTickets: boolean;
  defaultDurationSec: number;
  changeoverSec: number;
  headsUpAhead: number;
  paused: boolean;
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
  avgSessionSec: number;
  longestWaitSec: number | null;   // created → called, over called tickets
  projectedFinishAt: string | null; // null when queue empty
};

type QueueSnapshot = {
  serverTime: string;
  day: DayDTO | null;          // null = booth closed, no open day
  current: TicketDTO | null;   // CALLED or SERVING
  waiting: TicketDTO[];        // ordered by position
  recent: TicketDTO[];         // last 10 DONE / NO_SHOW / CANCELLED, newest first
  stats: StatsDTO;
};

type PublicTicketView = {       // customer; NO phone, notes, ids, or other names
  serverTime: string;
  boothOpen: boolean;
  number: number;
  firstName: string;            // first word of name
  status: TicketStatus;
  calledAt: string | null;
  nowServing: { number: number; status: 'CALLED' | 'SERVING' } | null;
  peopleAhead: number | null;   // WAITING only: waitingAhead + (current ? 1 : 0)
  almostUp: boolean;            // WAITING and peopleAhead <= day.headsUpAhead (see BUSINESS_LOGIC.md)
  eta: {
    sec: number; lowSec: number; highSec: number;
    estimatedAt: string; confidence: 'low' | 'medium' | 'high';
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
| POST | `/api/queue/undo` | — | **P1**. Reverts the most recent ActionLog entry of the Day if under 10 min old |

## Tickets and day (admin)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/day/open` | `{ defaultDurationSec?: number, changeoverSec?: number, headsUpAhead?: number /*0–10*/ }` | `QueueSnapshot`. `DAY_ALREADY_OPEN` |
| POST | `/api/day/close` | — | `{ summary: StatsDTO, snapshot: QueueSnapshot }` |
| PATCH | `/api/day` | `{ acceptingTickets?, defaultDurationSec?, changeoverSec?, headsUpAhead? }` | `QueueSnapshot` |
| GET | `/api/tickets` | query `search?`, `status?` (comma list) | `{ tickets: TicketDTO[] }` for the open Day, search matches name (case-insensitive contains), phone digits, or exact number |
| POST | `/api/tickets` | `{ name: string /*1–60*/, phone: string, notes?: string /*≤280*/, force?: boolean }` | `{ ticket: TicketDTO, snapshot: QueueSnapshot }`. `DUPLICATE_ACTIVE_TICKET` returns `details.existing: TicketDTO` |
| PATCH | `/api/tickets/:id` | `{ name?, phone?, notes? }` | `{ ticket, snapshot }` |
| DELETE | `/api/tickets/:id` | — | `QueueSnapshot`. Soft remove (CANCELLED/ADMIN_REMOVED) |
| POST | `/api/queue/reorder` | `{ order: string[] }` (every WAITING ticket id, in the new order) | `QueueSnapshot`. `409 VALIDATION_ERROR` if the set of ids doesn't exactly match the current WAITING tickets (covers a stale drag against a concurrent change) |
| POST | `/api/tickets/:id/rotate-token` | — | `{ ticket, snapshot }` |
| GET | `/api/days` | — | **P1** `{ days: (DayDTO & { summary: StatsDTO })[] }` |
| GET | `/api/days/:id/export.csv` | — | **P1** CSV of tickets |
