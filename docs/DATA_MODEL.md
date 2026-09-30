# Data Model

> The draw-from-photo feature (Phase 8, built) adds a `mode`, photo fields, a `READY` status and extra transitions; they are in the schema, state machine and invariants below. Details in `PHOTO_TICKETS.md`.
>
> The Events feature (after MVP) adds an `Event` model that groups Days (`Day.eventId`). See `EVENTS.md`.

## Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum DayStatus {
  OPEN
  CLOSED
}

enum TicketStatus {
  WAITING   // in line
  CALLED    // illustrator called them, not seated yet
  SERVING   // being drawn
  READY     // FROM_PHOTO drawing finished, waiting for pickup
  DONE      // finished (for FROM_PHOTO: picked up)
  NO_SHOW   // called but didn't come
  CANCELLED // by customer, admin, or day close
}

enum TicketMode {
  IN_PERSON
  FROM_PHOTO // set by the service when a photo is confirmed, never by staff directly
}

enum CancelReason {
  CUSTOMER
  ADMIN_REMOVED
  DAY_CLOSED
}

enum Role {
  ADMIN
  ILLUSTRATOR
  CUSTOMER
  SYSTEM
}

enum EventStatus {
  ACTIVE // the venue the booth is at now; at most one
  ENDED
}

// One venue or convention: groups the Days held there (EVENTS.md).
model Event {
  id        String      @id @default(cuid())
  name      String      // 1–60 chars
  status    EventStatus @default(ACTIVE)
  startedAt DateTime    @default(now())
  endedAt   DateTime?
  days      Day[]
  actions   ActionLog[]

  @@index([status])
}

model Day {
  id                 String    @id @default(cuid())
  eventId            String
  event              Event     @relation(fields: [eventId], references: [id])
  status             DayStatus @default(OPEN)
  openedAt           DateTime  @default(now())
  closedAt           DateTime?
  nextNumber         Int       @default(1)
  acceptingTickets   Boolean   @default(true)
  headsUpAhead       Int       @default(3)   // show "head back to the booth" when this many or fewer are ahead
  // Drawing time and time between customers are measured from recent tickets,
  // not stored (BUSINESS_LOGIC.md §5), scoped to the Day's Event.
  pausedAt           DateTime? // non-null = on break
  pauseUntil         DateTime? // null while paused = untimed break
  pauseReason        String?
  tickets            Ticket[]
  actions            ActionLog[]

  @@index([status])
  @@index([eventId])
}

model Ticket {
  id           String        @id @default(cuid())
  dayId        String
  day          Day           @relation(fields: [dayId], references: [id])
  number       Int           // 1, 2, 3... per Day, never reused
  name         String        // max 60 chars
  phone        String?       // E.164; nulled by the retention job 30 days after the Day closes
  notes        String?       // max 280 chars, staff only
  token        String        @unique // nanoid(16), customer credential
  status       TicketStatus  @default(WAITING)
  position     Int?          // order among WAITING tickets (1 = next); null when not WAITING
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  calledAt     DateTime?     // last time called (recall updates it)
  callCount    Int           @default(0)
  startedAt    DateTime?
  endedAt      DateTime?
  durationSec  Int?          // endedAt - startedAt, set on finish
  cancelledAt  DateTime?
  cancelReason CancelReason?
  mode            TicketMode @default(IN_PERSON)
  photoPath       String?    // storage pathname; null = no photo
  photoUploadedAt DateTime?
  readyAt         DateTime?  // FROM_PHOTO finish time
  pickedUpAt      DateTime?

  @@unique([dayId, number])
  @@index([dayId, status, position])
  @@index([phone])
  @@index([startedAt]) // recent-history lookup for the measured ETA
}

model ActionLog {
  id        String   @id @default(cuid())
  dayId     String?  // null for Event operations
  day       Day?     @relation(fields: [dayId], references: [id], onDelete: Restrict)
  eventId   String?  // set for Event operations (START_EVENT, RENAME_EVENT, END_EVENT)
  event     Event?   @relation(fields: [eventId], references: [id], onDelete: Restrict)
  ticketId  String?
  batchId   String?  // rows written by one request that Undo reverses together (Finish & call next)
  action    String   // e.g. "CALL_NEXT", "START", "FINISH", "NO_SHOW", "REQUEUE", "CANCEL", "PAUSE"
  actorRole Role
  before    Json?    // ticket/day fields before the change (enables Undo in P1)
  after     Json?
  createdAt DateTime @default(now())

  @@index([dayId, createdAt])
  @@index([eventId, createdAt])
}
```

### Extra migration SQL

Only one Day may be OPEN, and only one Event may be ACTIVE. Prisma can't express partial unique indexes, so they are added to migrations by hand:

```sql
CREATE UNIQUE INDEX "one_open_day" ON "Day" ("status") WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "Event_one_active" ON "Event" ("status") WHERE "status" = 'ACTIVE';
```

The Events migration backfills existing installs: one ACTIVE "First event" (started at the oldest Day's `openedAt`) owns every existing Day, so their measured wait-time history carries over. A database with no Days gets no Event and starts at "No event running".

## Ticket state machine

```
             call-next                start                 finish
  WAITING ─────────────▶ CALLED ─────────────▶ SERVING ─────────────▶ DONE
     │  ▲                 │  │
     │  │   requeue       │  │ no-show
     │  └─────────────────┘  ▼
     │  ▲               NO_SHOW
     │  └──── requeue ─────┘
     │
     └──▶ CANCELLED   (from WAITING or CALLED: customer cancel; from any non-SERVING, non-DONE status: admin remove; from WAITING or CALLED: day close)
```

| From | To | Action | Who |
|---|---|---|---|
| WAITING | CALLED | `call-next` (always the WAITING ticket with position 1) | Illustrator, Admin |
| WAITING | SERVING | `start` directly, only if it's position 1 and no current ticket exists | Illustrator, Admin |
| CALLED | SERVING | `start` | Illustrator, Admin |
| CALLED | WAITING | `requeue { afterCount }` (arrived but not ready, or late) | Illustrator, Admin |
| CALLED | NO_SHOW | `no-show` | Illustrator, Admin |
| NO_SHOW | WAITING | `requeue { afterCount }` (they showed up later) | Illustrator, Admin |
| SERVING | DONE | `finish` (in-person) | Illustrator, Admin |
| WAITING (FROM_PHOTO) | SERVING | `call-next` (skips CALLED), or `start` out of order when no ticket is current | Illustrator, Admin |
| SERVING (FROM_PHOTO) | READY | `finish`; sets `readyAt`, `durationSec`, deletes the photo | Illustrator, Admin |
| READY | DONE | `picked-up`; sets `pickedUpAt`; allowed after the Day closes | Illustrator, Admin |
| WAITING, CALLED | CANCELLED | customer `cancel` (CUSTOMER) | Customer |
| WAITING, CALLED, NO_SHOW, CANCELLED | CANCELLED | admin `DELETE` (ADMIN_REMOVED); a no-op re-write if already CANCELLED | Admin |
| WAITING, CALLED | CANCELLED | `close day` (DAY_CLOSED) | Admin |

Any other transition returns `409 INVALID_TRANSITION`. A SERVING or DONE ticket can't be removed; a SERVING ticket can't be cancelled by its customer either — finish it first. (Undo can reverse the last Call next / Start / Finish / No-show using `ActionLog.before`; see `BUSINESS_LOGIC.md` → Undo.)

## Invariants (enforce in the service layer, test them)

1. At most one Day with `status = OPEN`.
2. At most one ticket per Day with status `CALLED` or `SERVING` (the "current ticket").
3. WAITING tickets have positions exactly `1..n`, no gaps, no duplicates. Non-WAITING tickets have `position = null`.
4. `number` is unique per Day and assigned from `Day.nextNumber` inside the day lock.
5. `durationSec` is set if and only if `status` is `READY` or `DONE`.
6. Tickets can only be created while the Day is OPEN.
7. Pausing is only allowed when no ticket is SERVING.
8. At most one Event with `status = ACTIVE`.
9. An OPEN Day belongs to the ACTIVE Event.
10. An Event can't end, and a new one can't start, while a Day is OPEN.
11. `Event.endedAt` is set if and only if `status = ENDED`.
12. While a ticket is WAITING, CALLED or SERVING, `mode = FROM_PHOTO` if and only if `photoPath` is non-null.
13. READY tickets are never the current ticket and have no position.
