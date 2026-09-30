import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { PHONE_RETENTION_DAYS, purgeExpiredPhones } from "../src/services/retention.service.js";
import { resetDb, TEST_EVENT_NAME } from "./helpers.js";

const DAY_MS = 24 * 60 * 60 * 1000;
let app: Express;
let eventId: string;

beforeEach(async () => {
  await resetDb();
  app = createApp();
  eventId = (await prisma.event.findFirstOrThrow({ where: { name: TEST_EVENT_NAME } })).id;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

async function closedDay(closedDaysAgo: number | null) {
  return prisma.day.create({
    data: {
      eventId,
      status: closedDaysAgo == null ? "OPEN" : "CLOSED",
      closedAt: closedDaysAgo == null ? null : new Date(Date.now() - closedDaysAgo * DAY_MS),
    },
  });
}

async function ticket(dayId: string, number: number, phone: string | null = "+6281234560000") {
  return prisma.ticket.create({
    data: { dayId, number, name: `T${number}`, phone, token: `tok-${dayId}-${number}`, status: "DONE", durationSec: 600 },
  });
}

describe("purgeExpiredPhones", () => {
  it("erases phones only on Days closed more than 30 days ago", async () => {
    const old = await closedDay(PHONE_RETENTION_DAYS + 1);
    const recent = await closedDay(PHONE_RETENTION_DAYS - 1);
    const a = await ticket(old.id, 1);
    const b = await ticket(recent.id, 1);

    expect(await purgeExpiredPhones()).toBe(1);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: a.id } })).phone).toBeNull();
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: b.id } })).phone).not.toBeNull();
  });

  it("never touches an OPEN Day, keeps everything but the phone, and is idempotent", async () => {
    const open = await closedDay(null);
    const old = await closedDay(90);
    const keep = await ticket(open.id, 1);
    const erased = await ticket(old.id, 1);

    expect(await purgeExpiredPhones()).toBe(1);
    expect(await purgeExpiredPhones()).toBe(0);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: keep.id } })).phone).not.toBeNull();
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: erased.id } })).toMatchObject({
      phone: null,
      name: "T1",
      status: "DONE",
      durationSec: 600,
    });
  });

  it("counts by an injected clock", async () => {
    const day = await closedDay(10);
    await ticket(day.id, 1);
    expect(await purgeExpiredPhones(new Date(Date.now() + 25 * DAY_MS))).toBe(1);
  });
});

describe("GET /api/cron/retention", () => {
  it("refuses everyone when CRON_SECRET isn't set", async () => {
    expect((await request(app).get("/api/cron/retention")).status).toBe(401);
    expect((await request(app).get("/api/cron/retention").set("Authorization", "Bearer ")).status).toBe(401);
  });

  it("rejects a wrong secret and accepts the right one", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    const old = await closedDay(45);
    await ticket(old.id, 1);

    expect((await request(app).get("/api/cron/retention").set("Authorization", "Bearer nope")).status).toBe(401);
    const res = await request(app).get("/api/cron/retention").set("Authorization", "Bearer s3cret-value");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ phonesErased: 1 });
  });
});
