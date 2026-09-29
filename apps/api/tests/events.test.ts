import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { startEvent } from "../src/services/event.service.js";
import {
  assertEventInvariants,
  assertInvariants,
  createTicketViaApi,
  json,
  loginCookie,
  openDayViaApi,
  resetDb,
  TEST_EVENT_NAME,
} from "./helpers.js";

let app: Express;
let adminCookie: string;

beforeEach(async () => {
  await resetDb();
  app = createApp();
  adminCookie = await loginCookie(app, "ADMIN");
});

const post = (path: string, body: object = {}) => json(request(app).post(path).set("Cookie", adminCookie)).send(body);
const patch = (path: string, body: object) => json(request(app).patch(path).set("Cookie", adminCookie)).send(body);

async function serveOne(cookie: string, phone: string, durationSec: number): Promise<void> {
  const created = await createTicketViaApi(app, cookie, { name: "Cust", phone });
  const id = created.body.ticket.id as string;
  await json(request(app).post(`/api/tickets/${id}/start`).set("Cookie", cookie)).send({});
  const startedAt = new Date(Date.now() - durationSec * 1000);
  await prisma.ticket.update({ where: { id }, data: { startedAt } });
  await json(request(app).post(`/api/tickets/${id}/finish`).set("Cookie", cookie)).send({});
}

describe("Events: start / rename / end", () => {
  it("the snapshot carries the ACTIVE event and its Day count", async () => {
    const snap = await request(app).get("/api/queue").set("Cookie", adminCookie);
    expect(snap.body.event).toMatchObject({ name: TEST_EVENT_NAME, status: "ACTIVE", endedAt: null, dayCount: 0 });
  });

  it("startEvent ends the previous ACTIVE event and creates the new one", async () => {
    const res = await post("/api/events", { name: "Comic Con" });
    expect(res.status).toBe(200);
    expect(res.body.event.name).toBe("Comic Con");
    expect(res.body.event.status).toBe("ACTIVE");

    const events = await prisma.event.findMany({ orderBy: { startedAt: "asc" } });
    expect(events.map((e) => [e.name, e.status])).toEqual([
      [TEST_EVENT_NAME, "ENDED"],
      ["Comic Con", "ACTIVE"],
    ]);
    expect(events[0].endedAt).not.toBeNull();
    await assertEventInvariants();
  });

  it("startEvent works when no event is running", async () => {
    await prisma.event.deleteMany();
    const res = await post("/api/events", { name: "First venue" });
    expect(res.status).toBe(200);
    expect(await prisma.event.count({ where: { status: "ACTIVE" } })).toBe(1);
  });

  it("two concurrent startEvent calls leave exactly one ACTIVE event", async () => {
    const results = await Promise.allSettled([
      startEvent("ADMIN", { name: "A" }),
      startEvent("ADMIN", { name: "B" }),
      startEvent("ADMIN", { name: "C" }),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await prisma.event.count({ where: { status: "ACTIVE" } })).toBe(1);
    expect(await prisma.event.count()).toBe(4);
    await assertEventInvariants();
  });

  it("rejects an empty or over-long name", async () => {
    expect((await post("/api/events", { name: "   " })).status).toBe(400);
    expect((await post("/api/events", { name: "x".repeat(61) })).status).toBe(400);
    expect((await patch("/api/events/current", { name: "" })).status).toBe(400);
  });

  it("renameEvent renames the ACTIVE event, even while a Day is open", async () => {
    await openDayViaApi(app);
    const res = await patch("/api/events/current", { name: "  Renamed  " });
    expect(res.status).toBe(200);
    expect(res.body.event.name).toBe("Renamed");
    await assertEventInvariants();
  });

  it("renameEvent fails NO_ACTIVE_EVENT when none is running", async () => {
    await prisma.event.deleteMany();
    const res = await patch("/api/events/current", { name: "X" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NO_ACTIVE_EVENT");
  });

  it("endEvent leaves no ACTIVE event and returns its summary", async () => {
    const res = await post("/api/events/current/end");
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      dayCount: 0,
      servedCount: 0,
      noShowCount: 0,
      cancelledCount: 0,
      avgSessionSec: 0,
    });
    expect(res.body.snapshot.event).toBeNull();
    expect(await prisma.event.count({ where: { status: "ACTIVE" } })).toBe(0);
    await assertEventInvariants();
  });

  it("endEvent fails NO_ACTIVE_EVENT when none is running", async () => {
    await prisma.event.deleteMany();
    const res = await post("/api/events/current/end");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NO_ACTIVE_EVENT");
  });

  it("startEvent and endEvent fail DAY_OPEN while a Day is open, and change nothing", async () => {
    await openDayViaApi(app);

    const start = await post("/api/events", { name: "Nope" });
    expect(start.status).toBe(409);
    expect(start.body.error.code).toBe("DAY_OPEN");

    const end = await post("/api/events/current/end");
    expect(end.status).toBe(409);
    expect(end.body.error.code).toBe("DAY_OPEN");

    const events = await prisma.event.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: TEST_EVENT_NAME, status: "ACTIVE" });
    await assertEventInvariants();
  });

  it("every Event operation writes an ActionLog row with eventId and no dayId", async () => {
    await post("/api/events", { name: "One" });
    await patch("/api/events/current", { name: "Two" });
    await post("/api/events/current/end");

    const logs = await prisma.actionLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.action)).toEqual(["START_EVENT", "RENAME_EVENT", "END_EVENT"]);
    expect(logs.every((l) => l.dayId === null && l.eventId !== null)).toBe(true);
  });

  it("is admin only", async () => {
    const illustrator = await loginCookie(app, "ILLUSTRATOR");
    const bare = request(app);
    expect((await bare.get("/api/events")).status).toBe(401);
    expect((await bare.get("/api/events").set("Cookie", illustrator)).status).toBe(403);
    expect((await json(request(app).post("/api/events").set("Cookie", illustrator)).send({ name: "X" })).status).toBe(403);
    expect((await json(request(app).post("/api/events/current/end").set("Cookie", illustrator)).send({})).status).toBe(403);
    expect((await json(request(app).patch("/api/events/current").set("Cookie", illustrator)).send({ name: "X" })).status).toBe(403);
  });
});

describe("Events: opening a Day", () => {
  it("openDay without an ACTIVE event fails NO_ACTIVE_EVENT", async () => {
    await prisma.event.deleteMany();
    const res = await json(request(app).post("/api/day/open").set("Cookie", adminCookie)).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NO_ACTIVE_EVENT");
    expect(await prisma.day.count()).toBe(0);
  });

  it("openDay attaches the new Day to the ACTIVE event", async () => {
    await openDayViaApi(app);
    const day = await prisma.day.findFirstOrThrow({ include: { event: true } });
    expect(day.event.name).toBe(TEST_EVENT_NAME);
    await assertInvariants(day.id);
  });

  it("a second Day in the same event counts up, and the event lists its Days", async () => {
    await openDayViaApi(app);
    await post("/api/day/close");
    await post("/api/day/open");
    const snap = await request(app).get("/api/queue").set("Cookie", adminCookie);
    expect(snap.body.event.dayCount).toBe(2);

    await post("/api/day/close");
    const list = await request(app).get("/api/events").set("Cookie", adminCookie);
    expect(list.body.events).toHaveLength(1);
    expect(list.body.events[0].summary.dayCount).toBe(2);
  });
});

describe("Events: wait-time history is scoped to the event", () => {
  it("a new event starts from the built-in defaults; the old event keeps its pace", async () => {
    const { illustratorCookie } = await openDayViaApi(app);
    for (const [i, sec] of [300, 300, 300].entries()) {
      await serveOne(illustratorCookie, `08123456000${i}`, sec);
    }
    const eventA = await request(app).get("/api/queue").set("Cookie", adminCookie);
    expect(eventA.body.stats.avgSessionSec).toBeLessThan(600);

    await post("/api/day/close");
    await post("/api/events", { name: "Venue B" });
    await post("/api/day/open");

    const eventB = await request(app).get("/api/queue").set("Cookie", adminCookie);
    expect(eventB.body.stats.avgSessionSec).toBe(600);
    expect(eventB.body.stats.avgChangeoverSec).toBe(60);
    await assertEventInvariants();
  });

  it("closing and reopening a Day inside the same event carries the measured pace over", async () => {
    const { illustratorCookie } = await openDayViaApi(app);
    for (const [i, sec] of [300, 300, 300].entries()) {
      await serveOne(illustratorCookie, `08123456001${i}`, sec);
    }
    const before = await request(app).get("/api/queue").set("Cookie", adminCookie);

    await post("/api/day/close");
    await post("/api/day/open");
    const after = await request(app).get("/api/queue").set("Cookie", adminCookie);

    expect(after.body.stats.avgSessionSec).toBe(before.body.stats.avgSessionSec);
    expect(after.body.stats.avgSessionSec).toBeLessThan(600);
  });

  it("the summary counts served, no-show, cancelled and the plain average", async () => {
    const { illustratorCookie } = await openDayViaApi(app);
    await serveOne(illustratorCookie, "081234560020", 300);
    await serveOne(illustratorCookie, "081234560021", 500);
    await post("/api/day/close");

    const list = await request(app).get("/api/events").set("Cookie", adminCookie);
    expect(list.body.events[0].summary).toMatchObject({ dayCount: 1, servedCount: 2, avgSessionSec: 400 });
  });
});

describe("Events: customers never see the event", () => {
  it("the public ticket view and now-serving contain no event name or id", async () => {
    const { adminCookie: cookie } = await openDayViaApi(app);
    const created = await createTicketViaApi(app, cookie, { name: "Cust", phone: "081234560030" });
    const token = (created.body.ticket.customerUrl as string).split("/t/")[1];
    const event = await prisma.event.findFirstOrThrow();

    const view = await request(app).get(`/api/public/tickets/${token}`);
    const serving = await request(app).get("/api/public/now-serving");
    for (const body of [view.text, serving.text]) {
      expect(body).not.toContain(TEST_EVENT_NAME);
      expect(body).not.toContain(event.id);
      expect(body.toLowerCase()).not.toContain("event");
    }
  });
});
