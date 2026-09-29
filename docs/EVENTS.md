# Events (after MVP)

The booth moves between venues: a convention one weekend, a mall pop-up the next. Each place has its own pace (a quick sketch format at a busy con, longer portraits at a quiet market). An **Event** groups the Days at one venue, so each Event's wait-time estimates learn only from its own customers.

Build this **after the MVP ships** (Phase 9 in `IMPLEMENTATION_PLAN.md`). PRD rows A15–A16.

## What an Event scopes

| Thing | Scope |
|---|---|
| Measured drawing time and time between customers (`BUSINESS_LOGIC.md` §5) | **Event**: the last 10 customers across that Event's Days. A new Event starts from the built-in defaults (10 min / 1 min) |
| Ticket numbers | **Day**, unchanged: restart at 1 every time the booth opens |
| Queue, waiting list, recent list | **Day**, unchanged |
| Day history (A13) | Grouped by Event |
| Event summary | Totals across the Event's Days |

Naming: "Event" is the grouping. "Session" keeps its meaning of one drawing (Start → Finish).

## User stories

- As an admin arriving at a new venue, I start a new Event ("Comic Con Jakarta 2026") so the first customers there aren't given estimates based on the last venue.
- As an admin on day 2 of the same convention, I just open the booth. Yesterday's measured pace carries over because it's the same Event.
- As an admin, I rename an Event if I typed the name wrong.
- As an admin, I end an Event when the convention is over, and see a list of past Events with their dates and totals.

## Data model

```prisma
enum EventStatus {
  ACTIVE
  ENDED
}

model Event {
  id        String      @id @default(cuid())
  name      String      // 1–60 chars
  status    EventStatus @default(ACTIVE)
  startedAt DateTime    @default(now())
  endedAt   DateTime?
  days      Day[]

  @@index([status])
}

model Day {
  // ...existing fields
  eventId String
  event   Event  @relation(fields: [eventId], references: [id])

  @@index([eventId])
}
```

Only one Event may be ACTIVE. Add a partial unique index by hand, like the one-OPEN-Day index in `DATA_MODEL.md`:

```sql
CREATE UNIQUE INDEX "Event_one_active" ON "Event" ("status") WHERE "status" = 'ACTIVE';
```

**Migration / backfill**: create one ACTIVE Event named "First event" with `startedAt` = the oldest Day's `openedAt`, point every existing Day at it, then make `Day.eventId` required. Existing installs keep their measured history.

`ActionLog` gains a nullable `eventId` (relation to Event) and `dayId` becomes nullable. Event operations (`START_EVENT`, `RENAME_EVENT`, `END_EVENT`) log with `eventId` set and `dayId` null; every Day/ticket action keeps logging with `dayId` as today.

### Invariants (add to `DATA_MODEL.md` → Invariants)

1. At most one Event is ACTIVE.
2. An OPEN Day belongs to the ACTIVE Event.
3. An Event can't end, and a new one can't start, while a Day is OPEN.
4. `endedAt` is set if and only if status is ENDED.

## Business logic

All Event operations run in the service layer inside a transaction that first takes a transaction-scoped Postgres advisory lock (`pg_advisory_xact_lock`, see `lockEvents()` in `day-lock.ts`), and check for an OPEN Day inside the same transaction. `openDay` takes the same lock, so opening a Day can't slip in between an Event operation's `DAY_OPEN` check and its commit. An advisory lock is used instead of locking the ACTIVE Event row because with no ACTIVE Event there is no row to lock, and two concurrent "start event" calls would race. Each operation writes an ActionLog row (a start that ends the previous Event logs one `START_EVENT` row whose `before` is the ended Event).

| Operation | Rules |
|---|---|
| `startEvent({ name })` | Fails `DAY_OPEN` if a Day is open. Ends the current ACTIVE Event (status ENDED, `endedAt = now`) and creates the new ACTIVE one in the same transaction. |
| `endEvent()` | Fails `DAY_OPEN` if a Day is open; fails `NO_ACTIVE_EVENT` if none. Leaves no ACTIVE Event. |
| `renameEvent({ name })` | Renames the ACTIVE Event. Allowed while a Day is open. |
| `openDay` | Fails `NO_ACTIVE_EVENT` when no Event is ACTIVE; otherwise sets `eventId` to the ACTIVE Event. |

**ETA history scope**: `loadRecentHistory()` in `apps/api/src/services/snapshot.service.ts` is the single place that picks which Days feed the measured values. Change its ticket query from all Days to `{ day: { eventId } }` for the Day being viewed (a customer page of a closed Day uses that Day's Event). `recentHistory()` in `packages/shared/src/eta.ts` needs no change: it measures whatever it's given.

**Event summary**: `servedCount`, `noShowCount`, `cancelledCount`, `dayCount`, plain average drawing time over the Event's DONE tickets, `startedAt` / `endedAt`.

## API additions (`API.md`)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/events` | admin | — | `{ events: (EventDTO & { summary: EventSummaryDTO })[] }`, newest first |
| POST | `/api/events` | admin | `{ name: string /*1–60*/ }` | Start a new Event. `QueueSnapshot`. `DAY_OPEN` |
| PATCH | `/api/events/current` | admin | `{ name: string }` | `QueueSnapshot`. `NO_ACTIVE_EVENT` |
| POST | `/api/events/current/end` | admin | — | `{ summary: EventSummaryDTO, snapshot: QueueSnapshot }`. `DAY_OPEN`, `NO_ACTIVE_EVENT` |

```ts
type EventDTO = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'ENDED';
  startedAt: string;
  endedAt: string | null;
  dayCount: number; // Days opened so far, including one open now; drives "Day 3" on the closed card
};

type EventSummaryDTO = {
  dayCount: number;
  servedCount: number;
  noShowCount: number;
  cancelledCount: number;
  avgSessionSec: number; // plain average over the Event's valid drawings
};
```

- `QueueSnapshot` gains `event: EventDTO | null` (the ACTIVE Event, staff only).
- `POST /api/day/open` can now fail with `NO_ACTIVE_EVENT`.
- New 409 codes: `NO_ACTIVE_EVENT`, `DAY_OPEN`.
- Customer responses (`PublicTicketView`, now-serving) never include the Event. Customers only ever see the booth's own name (CLAUDE.md → Naming).
- Zod schemas `startEventSchema`, `renameEventSchema` in `packages/shared/src/schemas.ts`.

## UI changes (`UI.md`)

- **Admin → No open day card**: shows the ACTIVE Event's name above **Open booth** (e.g. "Comic Con Jakarta 2026 · Day 3"), with a small **Change** text button that opens the Events sheet. With no ACTIVE Event, the card reads "No event running" and its button is **Start event** instead of Open booth.
- **Start event sheet**: Name field (autofocus, 1–60 chars), footer "Wait-time estimates will start fresh for this event." Primary **Start Event**. When an Event is already ACTIVE, the footer adds "This ends {current name}." and the button asks for confirmation.
- **Admin menu**: new **Events** item → Events sheet: the ACTIVE Event on top (name, started date, Day count, served, **Rename**, **End Event**), then past Events (name, date range, Days, served). **Start New Event** at the bottom. While a Day is open, Start/End are disabled with the hint "Close the booth first."
- **Admin → Settings sheet**: the "Measured automatically…" footnote becomes "Measured from the last 10 customers at this event."
- **Admin → Day history (A13)**: Days grouped under Event headers.
- **Illustrator and customer screens**: no change.

## Tests

- Invariants 1–4 after every Event operation (extend `assertInvariants` in `apps/api/tests/helpers.ts`).
- `startEvent` ends the previous ACTIVE Event and creates the new one atomically; two concurrent `startEvent` calls leave exactly one ACTIVE Event.
- `startEvent` and `endEvent` fail `DAY_OPEN` while a Day is open.
- `openDay` without an ACTIVE Event fails `NO_ACTIVE_EVENT`; with one, the new Day gets its `eventId`.
- ETA: after Event A has history, the first Day of a new Event B gets `avgSessionSec` 600 and `avgChangeoverSec` 60 (built-in defaults); Event A's Days are unaffected.
- ETA: closing and reopening a Day inside the same Event carries the measured values over.
- Backfill migration: existing Days end up in one ACTIVE "First event".
- Public view never contains the Event name or id.
