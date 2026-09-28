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
| `openDay` | Fails with `DAY_ALREADY_OPEN` if one exists. Accepts optional `defaultDurationSec` (60–7200) and `changeoverSec` (0–1800). |
| `closeDay` | Fails if a ticket is SERVING (`CURRENT_ACTIVE`). All WAITING and CALLED tickets become CANCELLED/DAY_CLOSED. Sets `closedAt`, clears pause. Returns the day summary. |
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
  defaultDurationSec: number;
  changeoverSec: number;
  completedDurationsSec: number[]; // durationSec of DONE tickets in this Day
  current: { status: 'CALLED' | 'SERVING'; startedAt: Date | null } | null;
  waitingAhead: number;            // WAITING tickets ahead of this one
  pause: { until: Date | null } | null; // null = not paused
};

export type EtaResult = {
  avgSessionSec: number;
  etaSec: number;          // best estimate until this customer is called
  lowSec: number;
  highSec: number;
  estimatedAt: Date;       // now + etaSec
  confidence: 'low' | 'medium' | 'high';
  pausedUntimed: boolean;  // true = untimed break; etaSec excludes it
};
```

### Step 1: average session length

Uses every finished session in the current Day, as specified by the booth owner, with outlier protection and a smooth start:

```
MIN_VALID   = 60 s                      // shorter = accidental Start/Finish, ignore
clamp each d to [0.25 × default, 3 × default]
n    = number of valid durations
PRIOR_WEIGHT = 3
avg  = (sum(valid) + default × max(0, PRIOR_WEIGHT − n)) / max(PRIOR_WEIGHT, n)
```

With no data the average equals the default. Each finished session pulls it toward reality, and from the 3rd session on it's the plain (clamped) average of the day.

### Step 2: time until the current ticket frees the illustrator

```
cycle = avg + changeoverSec
if current is null:                 remaining = 0
if current.status == CALLED:        remaining = cycle
if current.status == SERVING:       remaining = max(avg − elapsed, 60) + changeoverSec
```

### Step 3: combine

```
pauseRemaining = pause && pause.until ? max(pause.until − now, 0) : 0
etaSec  = remaining + waitingAhead × cycle + pauseRemaining
lowSec  = round(etaSec × 0.8)
highSec = round(etaSec × 1.3)
confidence = n < 3 ? 'low' : n < 8 ? 'medium' : 'high'
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

Defaults unless stated: `default = 600`, `changeover = 60`, `now = 12:00:00`.

| # | Setup | Expected |
|---|---|---|
| 1 | no history, no current, waitingAhead 0 | avg 600, eta 0 |
| 2 | no history, SERVING started 4 min ago, ahead 2 | remaining 600−240+60 = 420; eta 420 + 2×660 = **1740** |
| 3 | history [300, 420, 360], CALLED, ahead 1 | avg 360, cycle 420, eta **840**, confidence medium |
| 4 | history [30] | 30 ignored, avg **600**, confidence low |
| 5 | history [5000] | clamped to 1800, avg (1800 + 1200)/3 = **1000** |
| 6 | history [300, 420, 360], SERVING elapsed 900 | remaining max(360−900, 60) + 60 = **120** |
| 7 | no current, ahead 0, paused until 12:10 | eta **600** |
| 8 | paused, `until` null, ahead 1, no history | eta 660, `pausedUntimed` true |
| 9 | 8 valid history items | confidence high |
| 10 | low/high | eta 1000 → low 800, high 1300 |

Heads-up tests (in the snapshot service, not `eta.ts`): threshold 3 with 4 ahead → `almostUp` false; 3 ahead → true; 0 ahead and nobody current → true; threshold 0 → always false; CALLED ticket → false (the takeover covers it).
