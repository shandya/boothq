import type { Day, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

// Every state-changing operation runs inside one transaction that first
// locks the open Day row (docs/BUSINESS_LOGIC.md §1). Because every
// mutation serializes on the same row, the invariants in DATA_MODEL.md
// hold without further locking.
export async function withOpenDayLock<T>(
  fn: (tx: Prisma.TransactionClient, day: Day) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      const [day] = await tx.$queryRaw<Day[]>`SELECT * FROM "Day" WHERE "status" = 'OPEN' FOR UPDATE`;
      if (!day) throw new AppError(409, "DAY_NOT_OPEN", "No day is open.");
      return fn(tx, day);
    },
    { maxWait: 10_000, timeout: 10_000 },
  );
}

// Serializes everything that decides which Event is ACTIVE or that attaches a
// Day to it: start/end Event and open Day. (docs/EVENTS.md says to lock the
// ACTIVE Event row, but with no ACTIVE Event there is no row to lock, and two
// concurrent "start event" calls would race. A transaction-scoped advisory
// lock covers both cases and works behind a pooled connection.)
export async function lockEvents(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('boothq:events'))`;
}

// Renumbers the given WAITING tickets to positions 1..n, in the given
// order (docs/BUSINESS_LOGIC.md §3). Callers pass every WAITING ticket id
// for the Day, in the order they should end up in.
export async function renumberWaiting(
  tx: Prisma.TransactionClient,
  dayId: string,
  orderedIds: string[],
): Promise<void> {
  for (const [index, id] of orderedIds.entries()) {
    await tx.ticket.updateMany({
      where: { id, dayId },
      data: { position: index + 1 },
    });
  }
}
