import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { assertInvariants, createTicketViaApi, json, openDayViaApi, resetDb } from "./helpers.js";

let app: Express;

beforeEach(async () => {
  await resetDb();
  app = createApp();
});

afterEach(async () => {
  const days = await prisma.day.findMany();
  for (const day of days) {
    await assertInvariants(day.id);
  }
});

function minutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60_000);
}

// The API stamps real times, so drawn tickets are backdated directly.
async function markDone(ticketId: string, created: number, start: number, end: number): Promise<void> {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "DONE",
      position: null,
      createdAt: minutesAgo(created),
      startedAt: minutesAgo(start),
      endedAt: minutesAgo(end),
      durationSec: (start - end) * 60,
    },
  });
}

describe("measured drawing time and time between customers", () => {
  it("snapshot stats reflect the last sessions and the Finish → next Start gap", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const a = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    const b = await createTicketViaApi(app, adminCookie, { name: "B", phone: "081234560002" });
    const c = await createTicketViaApi(app, adminCookie, { name: "C", phone: "081234560003" });
    // A: 10 min drawing, B waiting since the start, starts 2 min after A finishes.
    await markDone(a.body.ticket.id, 40, 30, 20);
    await markDone(b.body.ticket.id, 40, 18, 8);
    await markDone(c.body.ticket.id, 40, 6, 1);

    const res = await request(app).get("/api/queue").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    // sessions [300, 600, 600] → 500; gaps [120, 120] + one 60 s prior → 100
    expect(res.body.stats.avgSessionSec).toBe(500);
    expect(res.body.stats.avgChangeoverSec).toBe(100);
  });

  it("carries measurements over when the booth closes and reopens", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const a = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    const b = await createTicketViaApi(app, adminCookie, { name: "B", phone: "081234560002" });
    const c = await createTicketViaApi(app, adminCookie, { name: "C", phone: "081234560003" });
    await markDone(a.body.ticket.id, 90, 81, 61);
    await markDone(b.body.ticket.id, 90, 60, 40);
    await markDone(c.body.ticket.id, 90, 39, 19);

    const closed = await json(request(app).post("/api/day/close").set("Cookie", adminCookie)).send();
    expect(closed.status).toBe(200);
    expect(closed.body.summary.avgSessionSec).toBe(1200);

    const { adminCookie: adminCookie2 } = await openDayViaApi(app);
    const res = await request(app).get("/api/queue").set("Cookie", adminCookie2);
    expect(res.body.stats.avgSessionSec).toBe(1200);
    expect(res.body.stats.avgChangeoverSec).toBe(60);
  });
});
