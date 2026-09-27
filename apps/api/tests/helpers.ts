import type { Express } from "express";
import request from "supertest";
import { prisma } from "../src/lib/prisma.js";

export const TEST_PINS = { ADMIN: "111111", ILLUSTRATOR: "222222" } as const;

export async function resetDb(): Promise<void> {
  await prisma.actionLog.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.day.deleteMany();
}

// Checks the invariants in docs/DATA_MODEL.md that can be verified from
// stored state alone (invariant 6, "created only while OPEN", is enforced
// structurally by the service layer instead).
export async function assertInvariants(dayId: string): Promise<void> {
  const openDayCount = await prisma.day.count({ where: { status: "OPEN" } });
  if (openDayCount > 1) {
    throw new Error(`invariant violated: ${openDayCount} Days are OPEN at once`);
  }

  const day = await prisma.day.findUniqueOrThrow({ where: { id: dayId } });
  const tickets = await prisma.ticket.findMany({ where: { dayId } });

  const current = tickets.filter((t) => t.status === "CALLED" || t.status === "SERVING");
  if (current.length > 1) {
    throw new Error(`invariant violated: ${current.length} current (CALLED/SERVING) tickets in one Day`);
  }

  const waiting = tickets
    .filter((t) => t.status === "WAITING")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const positions = waiting.map((t) => t.position);
  const expectedPositions = waiting.map((_, i) => i + 1);
  if (JSON.stringify(positions) !== JSON.stringify(expectedPositions)) {
    throw new Error(`invariant violated: WAITING positions ${JSON.stringify(positions)}`);
  }
  const nonWaitingWithPosition = tickets.some((t) => t.status !== "WAITING" && t.position !== null);
  if (nonWaitingWithPosition) {
    throw new Error("invariant violated: a non-WAITING ticket has a position");
  }

  const numbers = tickets.map((t) => t.number);
  if (new Set(numbers).size !== numbers.length) {
    throw new Error("invariant violated: duplicate ticket numbers in one Day");
  }

  for (const t of tickets) {
    const shouldHaveDuration = t.status === "DONE";
    if (shouldHaveDuration !== (t.durationSec != null)) {
      throw new Error(`invariant violated: ticket ${t.id} status ${t.status} durationSec ${t.durationSec}`);
    }
  }

  if (day.pausedAt && tickets.some((t) => t.status === "SERVING")) {
    throw new Error("invariant violated: Day paused while a ticket is SERVING");
  }
}

export async function loginCookie(app: Express, role: keyof typeof TEST_PINS): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ role, pin: TEST_PINS[role] });
  const setCookie = res.headers["set-cookie"];
  if (res.status !== 200 || !setCookie) {
    throw new Error(`login as ${role} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookie.split(";")[0];
}
