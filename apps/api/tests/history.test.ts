import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createTicketViaApi, json, loginCookie, resetDb } from "./helpers.js";

let app: Express;
let admin: string;
let illustrator: string;

beforeEach(async () => {
  await resetDb();
  app = createApp();
  admin = await loginCookie(app, "ADMIN");
  illustrator = await loginCookie(app, "ILLUSTRATOR");
});

const post = (path: string, body: object = {}, cookie = admin) => json(request(app).post(path).set("Cookie", cookie)).send(body);
const get = (path: string, cookie = admin) => request(app).get(path).set("Cookie", cookie);

async function servedTicket(name: string, phone: string, durationSec: number): Promise<string> {
  const created = await createTicketViaApi(app, admin, { name, phone });
  const id = created.body.ticket.id as string;
  await post(`/api/tickets/${id}/start`);
  await prisma.ticket.update({ where: { id }, data: { startedAt: new Date(Date.now() - durationSec * 1000) } });
  await post(`/api/tickets/${id}/finish`, { callNext: false });
  return id;
}

// Event A: day 1 (2 served, 1 no-show, 1 removed) and day 2 (1 served);
// Event B: day 1, still open with one person waiting.
async function seedHistory() {
  await post("/api/day/open");
  await servedTicket("Ana", "081234560001", 300);
  await servedTicket("Budi", "081234560002", 500);
  const ghost = await createTicketViaApi(app, admin, { name: "Citra", phone: "081234560003" });
  await post("/api/queue/call-next");
  await post(`/api/tickets/${ghost.body.ticket.id}/no-show`);
  const gone = await createTicketViaApi(app, admin, { name: "Dewi", phone: "081234560004" });
  await json(request(app).delete(`/api/tickets/${gone.body.ticket.id}`).set("Cookie", admin)).send();
  await post("/api/day/close");

  await post("/api/day/open");
  await servedTicket("Eka", "081234560005", 600);
  await post("/api/day/close");

  await post("/api/events", { name: "Mall Pop-up" });
  await post("/api/day/open");
  await createTicketViaApi(app, admin, { name: "Fajar", phone: "081234560006" });
}

describe("GET /api/days", () => {
  it("lists Days newest first with their Event, number within the Event, and totals", async () => {
    await seedHistory();
    const res = await get("/api/days");
    expect(res.status).toBe(200);
    const days = res.body.days;

    expect(days.map((d: { event: { name: string }; dayNumber: number }) => [d.event.name, d.dayNumber])).toEqual([
      ["Mall Pop-up", 1],
      ["Test event", 2],
      ["Test event", 1],
    ]);
    expect(days[0]).toMatchObject({ status: "OPEN", closedAt: null });
    expect(days[0].summary).toMatchObject({ ticketCount: 1, servedCount: 0 });
    expect(days[1].summary).toMatchObject({ ticketCount: 1, servedCount: 1, avgSessionSec: 600 });
    expect(days[2]).toMatchObject({ status: "CLOSED" });
    expect(days[2].summary).toMatchObject({
      ticketCount: 4,
      servedCount: 2,
      noShowCount: 1,
      cancelledCount: 1,
      avgSessionSec: 400,
    });
    expect(typeof days[2].summary.longestWaitSec).toBe("number");
  });

  it("is empty before anything has happened", async () => {
    expect((await get("/api/days")).body).toEqual({ days: [] });
  });

  it("limit returns only the newest Days; an invalid limit is rejected", async () => {
    await seedHistory();
    const one = await get("/api/days?limit=1");
    expect(one.body.days).toHaveLength(1);
    expect(one.body.days[0].event.name).toBe("Mall Pop-up");
    expect((await get("/api/days?limit=0")).status).toBe(400);
    expect((await get("/api/days?limit=abc")).status).toBe(400);
    expect((await get("/api/days?limit=201")).status).toBe(400);
  });

  it("does not leak into customer responses, and is admin only", async () => {
    expect((await request(app).get("/api/days")).status).toBe(401);
    expect((await get("/api/days", illustrator)).status).toBe(403);
  });
});

describe("GET /api/days/:id/export.csv", () => {
  async function firstDayId(): Promise<string> {
    const days = (await get("/api/days")).body.days as { id: string; dayNumber: number; event: { name: string } }[];
    return days.find((d) => d.event.name === "Test event" && d.dayNumber === 1)!.id;
  }

  it("downloads one row per ticket, in ticket-number order, with a BOM and a helpful filename", async () => {
    await seedHistory();
    const res = await get(`/api/days/${await firstDayId()}/export.csv`).buffer(true).parse((r, cb) => {
      let data = "";
      r.setEncoding("utf8");
      r.on("data", (chunk) => (data += chunk));
      r.on("end", () => cb(null, data));
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="boothq-test-event-day-1-\d{4}-\d{2}-\d{2}\.csv"$/);

    const text = res.body as string;
    expect(text.startsWith("﻿")).toBe(true);
    const lines = text.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "Number,Name,Phone,Status,Notes,Cancel reason,Joined,Called,Started,Finished,Drawing (sec),Times called",
    );
    expect(lines).toHaveLength(5);

    const rows = lines.slice(1).map((l) => l.split(","));
    expect(rows.map((r) => r[0])).toEqual(["1", "2", "3", "4"]);
    expect(rows[0].slice(1, 4)).toEqual(["Ana", "+6281234560001", "DONE"]);
    expect(rows[0][10]).toBe("300");
    expect(rows[1][10]).toBe("500");
    expect(rows[2][3]).toBe("NO_SHOW");
    expect(rows[3][3]).toBe("CANCELLED");
    expect(rows[3][5]).toBe("ADMIN_REMOVED");
    expect(rows[0][6]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("quotes commas, quotes and line breaks, and defuses spreadsheet formulas", async () => {
    await post("/api/day/open");
    await createTicketViaApi(app, admin, {
      name: 'Doe, "DJ" Jane',
      phone: "081234560001",
      notes: "line one\nline two",
    });
    await createTicketViaApi(app, admin, { name: "=HYPERLINK(\"http://evil.example\",\"x\")", phone: "081234560002" });
    await createTicketViaApi(app, admin, { name: "+cmd", phone: "081234560003", notes: "@SUM(A1)" });
    const dayId = (await prisma.day.findFirstOrThrow()).id;

    const res = await get(`/api/days/${dayId}/export.csv`).buffer(true).parse((r, cb) => {
      let data = "";
      r.setEncoding("utf8");
      r.on("data", (chunk) => (data += chunk));
      r.on("end", () => cb(null, data));
    });
    const text = res.body as string;

    expect(text).toContain('"Doe, ""DJ"" Jane"');
    expect(text).toContain('"line one\nline two"');
    expect(text).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(text).toContain(",'+cmd,");
    expect(text).toContain(",'@SUM(A1),");
    expect(text).toContain(",+6281234560003,");
    for (const line of text.slice(1).split("\r\n")) {
      for (const cell of line.split(",")) expect(cell.startsWith("=")).toBe(false);
    }
  });

  it("works for the Day that is still open", async () => {
    await seedHistory();
    const open = (await get("/api/days")).body.days[0] as { id: string };
    const res = await get(`/api/days/${open.id}/export.csv`);
    expect(res.status).toBe(200);
  });

  it("404 for an unknown Day, and admin only", async () => {
    const unknown = await get("/api/days/nope/export.csv");
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("NOT_FOUND");

    await seedHistory();
    const id = await firstDayId();
    expect((await request(app).get(`/api/days/${id}/export.csv`)).status).toBe(401);
    expect((await get(`/api/days/${id}/export.csv`, illustrator)).status).toBe(403);
  });

  it("leaves the phone cell empty once a number has been erased", async () => {
    await post("/api/day/open");
    await createTicketViaApi(app, admin, { name: "Ana", phone: "081234560001" });
    await prisma.ticket.updateMany({ data: { phone: null } });
    const dayId = (await prisma.day.findFirstOrThrow()).id;
    const res = await get(`/api/days/${dayId}/export.csv`);
    expect(res.text).toContain("1,Ana,,WAITING,");
  });
});
