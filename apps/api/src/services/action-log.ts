import { Prisma } from "@prisma/client";
import type { Role } from "@boothq/shared";

// Day/ticket actions log with dayId; Event operations log with eventId and no
// dayId (docs/EVENTS.md → Data model).
export async function logAction(
  tx: Prisma.TransactionClient,
  params: {
    dayId?: string;
    eventId?: string;
    ticketId?: string;
    batchId?: string;
    action: string;
    actorRole: Role;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await tx.actionLog.create({
    data: {
      dayId: params.dayId,
      eventId: params.eventId,
      ticketId: params.ticketId,
      batchId: params.batchId,
      action: params.action,
      actorRole: params.actorRole,
      before: params.before === undefined ? Prisma.JsonNull : (params.before as Prisma.InputJsonValue),
      after: params.after === undefined ? Prisma.JsonNull : (params.after as Prisma.InputJsonValue),
    },
  });
}
