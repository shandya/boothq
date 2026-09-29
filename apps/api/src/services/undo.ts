import type { UndoDTO } from "@boothq/shared";
import type { ActionLog, Prisma, PrismaClient } from "@prisma/client";

// Server-side safety net; the web toast that offers Undo lasts 10 s
// (docs/UI.md → Feedback).
export const UNDO_WINDOW_MS = 10 * 60_000;

const UNDOABLE = new Set(["CALL_NEXT", "START", "FINISH", "NO_SHOW"]);

// Rows of one batch are reversed last-written-first. Finish & call next
// writes FINISH, then CALL_NEXT.
const BATCH_ORDER: Record<string, number> = { FINISH: 0, CALL_NEXT: 1 };

export type Undoable = { primary: ActionLog; rows: ActionLog[] };

// Undo is single-level: only the Day's most recent ActionLog entry can be
// reversed, so the Day's state is exactly that entry's `after` state and the
// reversal can't collide with anything newer. Undoing writes an UNDO entry,
// which is itself not undoable, so Undo can't ping-pong.
export async function loadUndoable(
  db: Pick<PrismaClient | Prisma.TransactionClient, "actionLog">,
  dayId: string,
  now: Date,
): Promise<Undoable | null> {
  const latest = await db.actionLog.findFirst({ where: { dayId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  if (!latest) return null;

  const rows = latest.batchId ? await db.actionLog.findMany({ where: { dayId, batchId: latest.batchId } }) : [latest];
  rows.sort((a, b) => (BATCH_ORDER[a.action] ?? 0) - (BATCH_ORDER[b.action] ?? 0));

  const primary = rows[0];
  if (!primary || !rows.every((r) => UNDOABLE.has(r.action) && r.ticketId != null)) return null;
  if (now.getTime() - primary.createdAt.getTime() > UNDO_WINDOW_MS) return null;
  return { primary, rows };
}

export function toUndoDTO(undoable: Undoable): UndoDTO {
  const { primary } = undoable;
  const after = primary.after as { number?: unknown } | null;
  return {
    actionId: primary.id,
    action: primary.action as UndoDTO["action"],
    ticketNumber: typeof after?.number === "number" ? after.number : 0,
    expiresAt: new Date(primary.createdAt.getTime() + UNDO_WINDOW_MS).toISOString(),
  };
}
