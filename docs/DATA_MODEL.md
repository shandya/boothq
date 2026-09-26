# Data Model

> The draw-from-photo feature (after MVP) adds a `mode`, photo fields, a `READY` status and extra transitions. See `PHOTO_TICKETS.md`; don't add them during MVP phases.

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
  DONE      // finished
  NO_SHOW   // called but didn't come
  CANCELLED // by customer, admin, or day close
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

model Day {
  id                 String    @id @default(cuid())
  status             DayStatus @default(OPEN)
  openedAt           DateTime  @default(now())
  closedAt           DateTime?
  nextNumber         Int       @default(1)
  acceptingTickets   Boolean   @default(true)
  defaultDurationSec Int       @default(600) // prior for ETA before real data exists
  changeoverSec      Int       @default(60)  // gap between customers (payment, seating)
  headsUpAhead       Int       @default(3)   // show "head back to the booth" when this many or fewer are ahead
  pausedAt           DateTime? // non-null = on break
  pauseUntil         DateTime? // null while paused = untimed break
  pauseReason        String?
  tickets            Ticket[]
  actions            ActionLog[]

  @@index([status])
}

model Ticket {
  id           String        @id @default(cuid())
  dayId        String
  day          Day           @relation(fields: [dayId], references: [id])
  number       Int           // 1, 2, 3... per Day, never reused
  name         String        // max 60 chars
  phone        String?       // E.164; nulled by the retention job (P1)
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

  @@unique([dayId, number])
  @@index([dayId, status, position])
  @@index([phone])
}

model ActionLog {
  id        String   @id @default(cuid())
  dayId     String
  day       Day      @relation(fields: [dayId], references: [id])
  ticketId  String?
  action    String   // e.g. "CALL_NEXT", "START", "FINISH", "NO_SHOW", "REQUEUE", "CANCEL", "PAUSE"
  actorRole Role
  before    Json?    // ticket/day fields before the change (enables Undo in P1)
  after     Json?
  createdAt DateTime @default(now())

  @@index([dayId, createdAt])
}
```

### Extra migration SQL

Only one Day may be OPEN. Add this to the first migration by hand:

```sql
CREATE UNIQUE INDEX "one_open_day" ON "Day" ("status") WHERE "status" = 'OPEN';
```

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
     └──▶ CANCELLED   (from WAITING or CALLED: customer cancel, admin remove, day close)
```

| From | To | Action | Who |
|---|---|---|---|
| WAITING | CALLED | `call-next` (always the WAITING ticket with position 1) | Illustrator, Admin |
| WAITING | SERVING | `start` directly, only if it's position 1 and no current ticket exists | Illustrator, Admin |
| CALLED | SERVING | `start` | Illustrator, Admin |
| CALLED | WAITING | `requeue { afterCount }` (arrived but not ready, or late) | Illustrator, Admin |
| CALLED | NO_SHOW | `no-show` | Illustrator, Admin |
| NO_SHOW | WAITING | `requeue { afterCount }` (they showed up later) | Illustrator, Admin |
| SERVING | DONE | `finish` | Illustrator, Admin |
| WAITING, CALLED | CANCELLED | customer `cancel` (CUSTOMER), `DELETE` (ADMIN_REMOVED), `close day` (DAY_CLOSED) | Customer, Admin |

Any other transition returns `409 INVALID_TRANSITION`. A SERVING ticket can't be removed or cancelled; finish it first. (P1 Undo can reverse the last action using `ActionLog.before`.)

## Invariants (enforce in the service layer, test them)

1. At most one Day with `status = OPEN`.
2. At most one ticket per Day with status `CALLED` or `SERVING` (the "current ticket").
3. WAITING tickets have positions exactly `1..n`, no gaps, no duplicates. Non-WAITING tickets have `position = null`.
4. `number` is unique per Day and assigned from `Day.nextNumber` inside the day lock.
5. `durationSec` is set if and only if `status = DONE`.
6. Tickets can only be created while the Day is OPEN.
7. Pausing is only allowed when no ticket is SERVING.
