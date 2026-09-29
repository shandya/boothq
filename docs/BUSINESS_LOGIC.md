# Business Logic

## 1. Concurrency: the day lock

Two staff phones may tap buttons at the same moment, and a customer may cancel at the same time the illustrator calls them. Every state-changing operation runs inside one Prisma interactive transaction that first locks the open Day row:

```ts
// apps/api/src/services/day-lock.ts
export async function withOpenDayLock<T>(
  fn: (tx: Prisma.TransactionClient, day: Day) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Day[]>`
      SELECT * FROM "Day" WHERE "status" = 'OPEN' FOR UPDATE`;
    if (rows.length === 0) throw new AppError('DAY_NOT_OPEN');
    return fn(tx, rows[0]);
  });
}
```

Because every mutation serializes on the same row, the invariants in `DATA_MODEL.md` hold without further locking. The queue is small (tens of tickets), so this is cheap.

### Stale-screen protection

Staff actions that target a ticket send its `id` in the URL. The service re-reads the ticket inside the lock and checks the transition is valid for its **current** status. If a double-tap already moved it, the second request gets `409` with the fresh snapshot in the error body, and the UI refreshes and shows a small toast ("Already updated").

`call-next` accepts an optional `expectedNextId`. If the WAITING ticket at position 1 isn't that id, return `409 STALE_STATE`. This stops the illustrator calling someone who isn't the person shown on their screen.

## 2. Ticket numbers

Inside the lock: `number = day.nextNumber`, then `day.nextNumber += 1`. Numbers are never reused, even after cancellations. They restart at 1 when a new Day opens.

## 3. Queue order (`position`)

- Only WAITING tickets have a position. Position 1 is next.
- **Create**: `position = (max WAITING position) + 1`.
- **Leaving WAITING** (called, cancelled, removed): set `position = null` and renumber the remaining WAITING tickets to `1..n`.
- **Reorder by drag** (admin): the admin drags rows in the Waiting list to a new order and confirms. The client sends the full ordered list of WAITING ticket ids; the service checks it's exactly the current WAITING set (same ids, same count) and writes positions `1..n` in that order. No single-step up/down/top/bottom endpoints.
- **Requeue `{ afterCount = 2 }`**: insert the ticket so that `afterCount` WAITING tickets are ahead of it (clamped to the queue length), then renumber `1..n`.

Always renumber the whole WAITING list in the transaction (a helper `renumberWaiting(tx, dayId, orderedIds)`). With small queues this is simpler and safer than fractional indexing.

## 4. Operations

| Operation | Rules |
|---|---|
| `openDay` | Fails with `DAY_ALREADY_OPEN` if one exists. Accepts optional `headsUpAhead` (0–10). Drawing time and time between customers are measured, not set (§5). |
| `closeDay` | Fails if a ticket is SERVING (`CURRENT_ACTIVE`). All WAITING and CALLED tickets become CANCELLED/DAY_CLOSED. Sets `closedAt`, clears pause. Returns the day summary, whose `avgSessionSec` is the plain average of that Day's valid drawings (not the rolling estimate). |
| `createTicket` | Day must be OPEN. If `acceptingTickets` is false, requires `force: true`. Normalize phone with libphonenumber-js using `DEFAULT_COUNTRY`; invalid → `VALIDATION_ERROR`. If this phone has an active ticket (WAITING, CALLED, SERVING) in the open Day and `force` isn't set → `409 DUPLICATE_ACTIVE_TICKET` with that ticket in `details`. Generate token with nanoid(16). |
| `callNext` | No current ticket allowed (`CURRENT_ACTIVE`). Queue must not be empty (`QUEUE_EMPTY`). Takes position 1 → CALLED, `calledAt = now`, `callCount += 1`. Rejected while paused (`DAY_PAUSED`). |
| `start` | Ticket must be CALLED, or WAITING at position 1 with no current ticket. Sets `startedAt = now`, status SERVING. Rejected while paused. |
| `finish` | Ticket must be SERVING. Sets `endedAt`, `durationSec = round((endedAt - startedAt)/1000)`, status DONE. If `callNext: true`, run `callNext` in the same transaction (skipped silently if the queue is empty). |
| `recall` | Ticket must be CALLED. `calledAt = now`, `callCount += 1`. The customer page shows the takeover again because `calledAt` changed. |
| `noShow` | Ticket must be CALLED. Status NO_SHOW. |
| `requeue` | Ticket must be CALLED or NO_SHOW. Status WAITING, clears `calledAt`, inserted per section 3. |
| `cancel` (customer) | Ticket must be WAITING or CALLED. Status CANCELLED/CUSTOMER. Idempotent: cancelling an already-cancelled ticket returns 200 with the current view. |
| `remove` (admin) | Ticket must be WAITING, CALLED or NO_SHOW (not SERVING, DONE, or already CANCELLED, so the original cancel reason is kept). Status CANCELLED/ADMIN_REMOVED. |
| `rotateToken` | Any status. New nanoid(16). The old link returns 404 from then on. |
| `pause` | No ticket may be SERVING. `pausedAt = now`, `pauseUntil = now + minutes` or null for untimed, optional reason (max 80 chars). |
| `resume` | Clears `pausedAt`, `pauseUntil`, `pauseReason`. A timed break does **not** auto-resume: once `pauseUntil` passes, customers see "Back any moment" and ETAs stop adding break time until the illustrator taps Resume. |

Every operation writes an `ActionLog` row with `before` and `after` for the tickets and day fields it touched.

## 5. ETA algorithm

Lives in `packages/shared/src/eta.ts` as a **pure function** so it can be unit-tested and reused by the API (customer ETAs, projected finish time).

### Inputs and outputs

```ts
export type EtaInput = {
  now: Date;
  recentSessionsSec: number[];     // newest first, from recentHistory()
  recentChangeoversSec: number[];  // newest first, from recentHistory()
  current: { status: 'CALLED' | 'SERVING'; startedAt: Date | null } | null;
  waitingAhead: number;            // WAITING tickets ahead of this one
  pause: { until: Date | null } | null; // null = not paused
};

export type EtaResult = {
  avgSessionSec: number;
  avgChangeoverSec: number;
  etaSec: number;          // best estimate until this customer is called
  lowSec: number;
  highSec: number;
  estimatedAt: Date;       // now + etaSec
  confidence: 'low' | 'medium' | 'high';
  pausedUntimed: boolean;  // true = untimed break; etaSec excludes it
};
```

Staff never type the drawing time or the time between customers: both are **measured from the last 10 customers**.

### Step 0: collecting history (`recentHistory`)

`recentHistory({ tickets, pauses })` in `eta.ts` is pure and scope-agnostic: it measures whatever tickets it is given. The API's `loadRecentHistory()` (`snapshot.service.ts`) is the **only** place that decides which Days count. It loads the 30 most recent tickets with a `startedAt`, plus the `PAUSE` actions since the oldest of them.

- **History scope**: the Days of the current Event (see `EVENTS.md`). Until Events ship, that's every Day, so a new Day starts from the previous Day's measurements.
- **Drawing times**: `durationSec` of DONE tickets, newest `endedAt` first.
- **Time between customers**: for each DONE ticket P, the next ticket started in the **same Day** after P's Finish. The gap `next.startedAt − P.endedAt` counts only if the next customer was already in line at Finish (`next.createdAt <= P.endedAt`) and no break started in between. That keeps idle time (nobody waiting) and breaks out of it. The gap naturally includes calling, walking up, payment and any no-shows in between.

### Step 1: averages

```
DEFAULT_SESSION    = 600 s              // used only while there's little or no history
DEFAULT_CHANGEOVER = 60 s
WINDOW             = 10                 // newest valid values only
valid session      = 60 s ≤ d ≤ 7200 s  // shorter = accidental Start/Finish
valid changeover   = 0 s ≤ g ≤ 1800 s
PRIOR_WEIGHT       = 3
avg(values, prior) = (sum + prior × max(0, PRIOR_WEIGHT − n)) / max(PRIOR_WEIGHT, n)
avgSession   = avg(first WINDOW valid sessions, DEFAULT_SESSION)
avgChangeover = avg(first WINDOW valid changeovers, DEFAULT_CHANGEOVER)
```

Invalid values are dropped, not clamped. With no data the averages equal the defaults. Each measurement pulls them toward reality; from the 3rd one on it's the plain average of the last (up to) 10.

### Step 2: time until the current ticket frees the illustrator

```
cycle = avgSession + avgChangeover
if current is null:                 remaining = 0
if current.status == CALLED:        remaining = cycle
if current.status == SERVING:       remaining = max(avgSession − elapsed, 60) + avgChangeover
```

### Step 3: combine

```
pauseRemaining = pause && pause.until ? max(pause.until − now, 0) : 0
etaSec  = remaining + waitingAhead × cycle + pauseRemaining
lowSec  = round(etaSec × 0.8)
highSec = round(etaSec × 1.3)
confidence = n < 3 ? 'low' : n < 8 ? 'medium' : 'high'   // n = valid sessions used
pausedUntimed = pause != null && pause.until == null
```

The customer whose own ticket is CALLED or SERVING doesn't get an ETA; the page shows the status instead.

### Display rules (`packages/shared/src/format.ts`)

- `etaSec < 60` → "Any moment now"
- `< 10 min` → exact minutes, e.g. "~7 min"
- otherwise a range rounded to 5 min, e.g. "~20–25 min", plus "around 14:35" (formatted on the client in the phone's local time)
- confidence `low` → add "Estimate gets more accurate as the day goes on"
- `pausedUntimed` → banner "The illustrator is on a short break" and the ETA line reads "~X min after the break"

### Heads-up ("almost up")

A WAITING ticket is **almost up** when `peopleAhead <= day.headsUpAhead` (default 3, range 0–10; 0 disables it). `peopleAhead` counts WAITING tickets ahead plus the current CALLED/SERVING ticket, exactly as shown on the customer page. The API computes it and returns `almostUp` so the rule lives in one place. Banner copy:

- ETA ≥ 1 min: "Start heading back to the booth" / "Only {n} people ahead of you. Your turn is in about {eta}." (use "1 person" for n = 1)
- ETA < 1 min: "You're next" / "Please come to the booth now so you're ready."
- While the booth is on break, keep the banner and add "(after the break)" to the ETA.

It is stateless (derived on every request), so reordering, requeues and cancellations can make it appear or disappear; that's intended.

### Projected finish (illustrator stats)

Projected finish = `now + ETA of a hypothetical ticket behind the last WAITING ticket` (i.e. `waitingAhead = waitingCount`), displayed as a clock time.

### Required unit tests

`now = 12:00:00`; "sessions" = `recentSessionsSec`, "gaps" = `recentChangeoversSec`, both empty unless stated.

| # | Setup | Expected |
|---|---|---|
| 1 | no history, no current, waitingAhead 0 | avg 600, changeover 60, eta 0 |
| 2 | no history, SERVING started 4 min ago, ahead 2 | remaining 600−240+60 = 420; eta 420 + 2×660 = **1740** |
| 3 | sessions [300, 420, 360], CALLED, ahead 1 | avg 360, cycle 420, eta **840**, confidence medium |
| 4 | sessions [30] | 30 ignored, avg **600**, confidence low |
| 5 | sessions [1800]; then [9000] | (1800 + 1200)/3 = **1000**; 9000 dropped → **600** |
| 6 | sessions [300, 420, 360], SERVING elapsed 900 | remaining max(360−900, 60) + 60 = **120** |
| 7 | no current, ahead 0, paused until 12:10 | eta **600** |
| 8 | paused, `until` null, ahead 1, no history | eta 660, `pausedUntimed` true |
| 9 | 8 valid sessions | confidence high |
| 10 | sessions [1000 ×3], gaps [0 ×3], ahead 1 | eta 1000 → low 800, high 1300 |
| 11 | sessions [600 ×10, 6000] | only the newest 10 count → avg **600** |
| 12 | gaps [120] | changeover (120 + 120)/3 = **80** |
| 13 | sessions [600 ×3], gaps [120 ×3], ahead 2 | eta 2 × 720 = **1440** |

`recentHistory` tests: sessions newest first; gap measured Finish → next Start when the next customer was waiting; a started-but-unfinished ticket counts as "next"; idle gap (next created after Finish) ignored; gap with a break in between ignored; gap > 1800 s dropped; sessions from other Days included but gaps never paired across Days.

API tests: snapshot `stats.avgSessionSec` / `avgChangeoverSec` reflect backdated tickets; closing and reopening a Day carries the measurements over; close summary `avgSessionSec` is that Day's own average.

Heads-up tests (in the snapshot service, not `eta.ts`): threshold 3 with 4 ahead → `almostUp` false; 3 ahead → true; 0 ahead and nobody current → true; threshold 0 → always false; CALLED ticket → false (the takeover covers it).
