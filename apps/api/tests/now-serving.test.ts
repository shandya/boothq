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
  for (const day of await prisma.day.findMany()) await assertInvariants(day.id);
});

describe("GET /api/public/now-serving", () => {
  it("reports a closed booth when no Day is open", async () => {
    const res = await request(app).get("/api/public/now-serving");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toMatchObject({ boothOpen: false, paused: false, nowServing: null, next: [], waitingCount: 0 });
  });

  it("shows the current number, up to 3 next numbers and the waiting count, without names", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    for (let i = 1; i <= 5; i++) {
      await createTicketViaApi(app, adminCookie, { name: `Secret Person${i}`, phone: `08123456010${i}` });
    }
    await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});

    const res = await request(app).get("/api/public/now-serving");
    expect(res.body).toMatchObject({ boothOpen: true, paused: false, nowServing: 1, next: [2, 3, 4], waitingCount: 4 });
    expect(Object.keys(res.body).sort()).toEqual(
      ["boothOpen", "next", "nowServing", "paused", "serverTime", "waitingCount"].sort(),
    );
    expect(res.text).not.toContain("Secret");
    expect(res.text).not.toContain("0812345");
  });

  it("reports paused during a break", async () => {
    const { illustratorCookie } = await openDayViaApi(app);
    await json(request(app).post("/api/day/pause").set("Cookie", illustratorCookie)).send({});
    const res = await request(app).get("/api/public/now-serving");
    expect(res.body.paused).toBe(true);
  });
});
