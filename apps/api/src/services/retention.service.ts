import { prisma } from "../lib/prisma.js";

// docs/PRD.md A14: phone numbers are personal data, so they are erased this
// many days after the Day they belong to closed.
export const PHONE_RETENTION_DAYS = 30;

// Nulls `phone` on tickets of Days that closed more than PHONE_RETENTION_DAYS
// ago. Idempotent; returns how many numbers were erased.
export async function purgeExpiredPhones(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PHONE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.ticket.updateMany({
    where: { phone: { not: null }, day: { status: "CLOSED", closedAt: { lt: cutoff } } },
    data: { phone: null },
  });
  return result.count;
}
