import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import {
  assertInvariants,
  createTicketViaApi,
  json,
  openDayViaApi,
  resetDb,
} from "./helpers.js";

let app: Express;
let illustrator: string;
let admin: string;
let dayId: string;

beforeEach(async () => {
  await resetDb();
  app = createApp();
  ({ adminCookie: admin, illustratorCookie: illustrator } = await openDayViaApi(app));
  dayId = (await prisma.day.findFirstOrThrow()).id;
});

const phones = ["081234560001", "081234560002", "081234560003", "081234560004"];

async function makeTickets(count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const res = await createTicketViaApi(app, illustrator, { name: `Cust ${i + 1}`, phone: phones[i] });
    ids.push(res.body.ticket.id as string);
  }
  return ids;
}

const post = (path: string, cookie = illustrator, body: object = {}) =>
  json(request(app).post(path).set("Cookie", cookie)).send(body);
const undo = (body: object = {}, cookie = illustrator) => post("/api/queue/undo", cookie, body);
const snapshot = async () => (await request(app).get("/api/queue").set("Cookie", illustrator)).body;

async function state() {
  const tickets = await prisma.ticket.findMany({ orderBy: { number: "asc" } });
  return tickets.map((t) => `${t.number}:${t.status}${t.position != null ? `@${t.position}` : ""}`);
}

describe("Undo", () => {
  it("call next: puts the ticket back at the front of the line, with the others shifted back", async () => {
    await makeTickets(3);
    await post("/api/queue/call-next");
    expect(await state()).toEqual(["1:CALLED", "2:WAITING@1", "3:WAITING@2"]);

    const before = await snapshot();
    expect(before.undo).toMatchObject({ action: "CALL_NEXT", ticketNumber: 1 });

    const res = await undo({ expectedActionId: before.undo.actionId });
    expect(res.status).toBe(200);
    expect(await state()).toEqual(["1:WAITING@1", "2:WAITING@2", "3:WAITING@3"]);

    const t1 = await prisma.ticket.findFirstOrThrow({ where: { number: 1 } });
    expect(t1.callCount).toBe(0);
    expect(t1.calledAt).toBeNull();
    expect(res.body.undo).toBeNull();
    await assertInvariants(dayId);
  });

  it("start after call: goes back to CALLED", async () => {
    const [t1] = await makeTickets(2);
    await post("/api/queue/call-next");
    await post(`/api/tickets/${t1}/start`);
    expect((await snapshot()).undo).toMatchObject({ action: "START", ticketNumber: 1 });

    expect((await undo()).status).toBe(200);
    expect(await state()).toEqual(["1:CALLED", "2:WAITING@1"]);
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: t1 } });
    expect(ticket.startedAt).toBeNull();
    await assertInvariants(dayId);
  });

  it("start directly from the line: goes back to the front of the line", async () => {
    const [t1] = await makeTickets(3);
    await post(`/api/tickets/${t1}/start`);
    expect(await state()).toEqual(["1:SERVING", "2:WAITING@1", "3:WAITING@2"]);

    expect((await undo()).status).toBe(200);
    expect(await state()).toEqual(["1:WAITING@1", "2:WAITING@2", "3:WAITING@3"]);
    await assertInvariants(dayId);
  });

  it("finish: the ticket is being drawn again, keeping its start time and clearing the duration", async () => {
    const [t1] = await makeTickets(1);
    await post(`/api/tickets/${t1}/start`);
    const started = await prisma.ticket.findUniqueOrThrow({ where: { id: t1 } });
    await post(`/api/tickets/${t1}/finish`, illustrator, { callNext: false });
    expect((await snapshot()).stats.servedCount).toBe(1);
    expect((await snapshot()).undo).toMatchObject({ action: "FINISH", ticketNumber: 1 });

    expect((await undo()).status).toBe(200);
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: t1 } });
    expect(ticket.status).toBe("SERVING");
    expect(ticket.startedAt?.toISOString()).toBe(started.startedAt?.toISOString());
    expect(ticket.endedAt).toBeNull();
    expect(ticket.durationSec).toBeNull();
    expect((await snapshot()).stats.servedCount).toBe(0);
    await assertInvariants(dayId);
  });

  it("finish & call next: undoes both, in one step", async () => {
    const [t1] = await makeTickets(3);
    await post(`/api/tickets/${t1}/start`);
    await post(`/api/tickets/${t1}/finish`, illustrator, { callNext: true });
    expect(await state()).toEqual(["1:DONE", "2:CALLED", "3:WAITING@1"]);
    expect((await snapshot()).undo).toMatchObject({ action: "FINISH", ticketNumber: 1 });

    expect((await undo()).status).toBe(200);
    expect(await state()).toEqual(["1:SERVING", "2:WAITING@1", "3:WAITING@2"]);
    expect((await snapshot()).undo).toBeNull();
    await assertInvariants(dayId);
  });

  it("no-show: the ticket is CALLED again", async () => {
    const [t1] = await makeTickets(2);
    await post("/api/queue/call-next");
    await post(`/api/tickets/${t1}/no-show`);
    expect(await state()).toEqual(["1:NO_SHOW", "2:WAITING@1"]);

    expect((await undo()).status).toBe(200);
    expect(await state()).toEqual(["1:CALLED", "2:WAITING@1"]);
    await assertInvariants(dayId);
  });

  it("is single-level: a second undo has nothing to undo, and the undo itself is logged", async () => {
    await makeTickets(2);
    await post("/api/queue/call-next");
    expect((await undo()).status).toBe(200);

    const again = await undo();
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("NOTHING_TO_UNDO");
    expect(again.body.error.details.snapshot.undo).toBeNull();

    const logs = await prisma.actionLog.findMany({ where: { dayId, action: "UNDO" } });
    expect(logs).toHaveLength(1);
    expect(logs[0].actorRole).toBe("ILLUSTRATOR");
  });

  it("can be followed by redoing the action normally", async () => {
    await makeTickets(2);
    await post("/api/queue/call-next");
    await undo();
    expect((await post("/api/queue/call-next")).status).toBe(200);
    expect(await state()).toEqual(["1:CALLED", "2:WAITING@1"]);
    await assertInvariants(dayId);
  });
});

describe("Undo: when it is not allowed", () => {
  it("nothing has happened yet", async () => {
    const res = await undo();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NOTHING_TO_UNDO");
  });

  it("another action came after the call (new ticket, break, recall)", async () => {
    await makeTickets(2);
    await post("/api/queue/call-next");
    await createTicketViaApi(app, illustrator, { name: "Late", phone: phones[2] });
    expect((await snapshot()).undo).toBeNull();
    expect((await undo()).body.error.code).toBe("NOTHING_TO_UNDO");

    const [c1] = await prisma.ticket.findMany({ where: { status: "CALLED" } });
    await post(`/api/tickets/${c1.id}/recall`);
    expect((await undo()).body.error.code).toBe("NOTHING_TO_UNDO");
  });

  it("the action is older than 10 minutes", async () => {
    await makeTickets(1);
    await post("/api/queue/call-next");
    const log = await prisma.actionLog.findFirstOrThrow({ where: { action: "CALL_NEXT" } });
    await prisma.actionLog.update({ where: { id: log.id }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } });

    expect((await snapshot()).undo).toBeNull();
    const res = await undo();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NOTHING_TO_UNDO");
    expect(await state()).toEqual(["1:CALLED"]);
  });

  it("the caller was looking at a different (older) action", async () => {
    const [t1] = await makeTickets(2);
    await post("/api/queue/call-next");
    const stale = (await snapshot()).undo.actionId as string;
    await post(`/api/tickets/${t1}/start`);

    const res = await undo({ expectedActionId: stale });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_STATE");
    expect(res.body.error.details.snapshot.undo.action).toBe("START");
    expect(await state()).toEqual(["1:SERVING", "2:WAITING@1"]);
  });

  it("the booth is closed", async () => {
    await makeTickets(1);
    await post("/api/queue/call-next");
    await post("/api/day/close", admin);
    const res = await undo();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DAY_NOT_OPEN");
  });

  it("requires a staff session", async () => {
    expect((await json(request(app).post("/api/queue/undo")).send({})).status).toBe(401);
    expect((await undo({}, admin)).status).toBe(409); // an admin is allowed; there's just nothing to undo
  });
});

describe("Undo: effects seen elsewhere", () => {
  it("a customer who was called is back in line, not still shown as called", async () => {
    const created = await createTicketViaApi(app, illustrator, { name: "Cust", phone: phones[0] });
    const token = (created.body.ticket.customerUrl as string).split("/t/")[1];
    await post("/api/queue/call-next");
    expect((await request(app).get(`/api/public/tickets/${token}`)).body.status).toBe("CALLED");

    await undo();
    const view = await request(app).get(`/api/public/tickets/${token}`);
    expect(view.body.status).toBe("WAITING");
    expect(view.body.peopleAhead).toBe(0);
  });

  it("an undone finish no longer counts toward the measured drawing time", async () => {
    const [t1] = await makeTickets(1);
    await post(`/api/tickets/${t1}/start`);
    await prisma.ticket.update({ where: { id: t1 }, data: { startedAt: new Date(Date.now() - 300_000) } });
    await post(`/api/tickets/${t1}/finish`, illustrator, { callNext: false });
    expect((await snapshot()).stats.avgSessionSec).toBeLessThan(600);

    await undo();
    expect((await snapshot()).stats.avgSessionSec).toBe(600);
  });
});
