import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { assertInvariants, createTicketViaApi, json, loginCookie, openDayViaApi, resetDb } from "./helpers.js";

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

function tokenFromCustomerUrl(customerUrl: string): string {
  const token = customerUrl.split("/t/")[1];
  if (!token) throw new Error(`no token in ${customerUrl}`);
  return token;
}

describe("open/close day", () => {
  it("rejects opening a second day", async () => {
    await openDayViaApi(app);
    const adminCookie = await loginCookie(app, "ADMIN");
    const res = await json(request(app).post("/api/day/open").set("Cookie", adminCookie)).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DAY_ALREADY_OPEN");
  });

  it("restarts ticket numbers at 1 on a new day", async () => {
    const { adminCookie } = await openDayViaApi(app);
    await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    await createTicketViaApi(app, adminCookie, { name: "B", phone: "081234560002" });
    await json(request(app).post("/api/day/close").set("Cookie", adminCookie)).send();

    const { adminCookie: adminCookie2 } = await openDayViaApi(app);
    const t = await createTicketViaApi(app, adminCookie2, { name: "C", phone: "081234560003" });
    expect(t.body.ticket.number).toBe(1);
  });

  it("cancels WAITING/CALLED with DAY_CLOSED, blocked while SERVING", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    await createTicketViaApi(app, adminCookie, { name: "B", phone: "081234560002" });
    await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});
    await json(
      request(app).post(`/api/tickets/${t1.body.ticket.id}/start`).set("Cookie", illustratorCookie),
    ).send({});

    const blockedClose = await json(request(app).post("/api/day/close").set("Cookie", adminCookie)).send();
    expect(blockedClose.status).toBe(409);
    expect(blockedClose.body.error.code).toBe("CURRENT_ACTIVE");

    await json(
      request(app).post(`/api/tickets/${t1.body.ticket.id}/finish`).set("Cookie", illustratorCookie),
    ).send({});
    const closed = await json(request(app).post("/api/day/close").set("Cookie", adminCookie)).send();
    expect(closed.status).toBe(200);
    expect(closed.body.snapshot.day).toBeNull();
    expect(closed.body.summary.servedCount).toBe(1);
    expect(closed.body.summary.cancelledCount).toBe(1);
  });
});

describe("createTicket", () => {
  it("rejects a duplicate active phone unless forced", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const first = await createTicketViaApi(app, adminCookie, { name: "Amara", phone: "081234560001" });
    expect(first.status).toBe(200);

    const dup = await createTicketViaApi(app, adminCookie, { name: "Amara Again", phone: "081234560001" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("DUPLICATE_ACTIVE_TICKET");
    expect(dup.body.error.details.existing.id).toBe(first.body.ticket.id);

    const forced = await createTicketViaApi(app, adminCookie, {
      name: "Amara Again",
      phone: "081234560001",
      force: true,
    });
    expect(forced.status).toBe(200);
  });

  it("blocks new tickets when not accepting, unless forced", async () => {
    const { adminCookie } = await openDayViaApi(app);
    await json(request(app).patch("/api/day").set("Cookie", adminCookie)).send({ acceptingTickets: false });

    const blocked = await createTicketViaApi(app, adminCookie, { name: "Amara", phone: "081234560001" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("NOT_ACCEPTING");

    const forced = await createTicketViaApi(app, adminCookie, {
      name: "Amara",
      phone: "081234560001",
      force: true,
    });
    expect(forced.status).toBe(200);
  });

  it("allows an illustrator to register a walk-up, but not edit, remove, or list tickets", async () => {
    const { illustratorCookie } = await openDayViaApi(app);
    const created = await createTicketViaApi(app, illustratorCookie, { name: "Amara", phone: "081234560001" });
    expect(created.status).toBe(200);
    expect(created.body.ticket.number).toBe(1);

    const id = created.body.ticket.id;
    const patch = await json(request(app).patch(`/api/tickets/${id}`).set("Cookie", illustratorCookie)).send({
      name: "Someone Else",
    });
    expect(patch.status).toBe(403);
    expect(patch.body.error.code).toBe("FORBIDDEN");

    const remove = await request(app).delete(`/api/tickets/${id}`).set("Cookie", illustratorCookie);
    expect(remove.status).toBe(403);

    const list = await request(app).get("/api/tickets").set("Cookie", illustratorCookie);
    expect(list.status).toBe(403);
  });

  it("assigns sequential numbers, never reused after cancel", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    const t2 = await createTicketViaApi(app, adminCookie, { name: "B", phone: "081234560002" });
    const t3 = await createTicketViaApi(app, adminCookie, { name: "C", phone: "081234560003" });
    expect([t1.body.ticket.number, t2.body.ticket.number, t3.body.ticket.number]).toEqual([1, 2, 3]);

    await json(request(app).delete(`/api/tickets/${t2.body.ticket.id}`).set("Cookie", adminCookie)).send();
    const t4 = await createTicketViaApi(app, adminCookie, { name: "D", phone: "081234560004" });
    expect(t4.body.ticket.number).toBe(4);
  });
});

describe("full happy path", () => {
  it("create → call-next → start → finish → DONE with durationSec", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    const created = await createTicketViaApi(app, adminCookie, { name: "Amara", phone: "081234560001" });
    const ticketId: string = created.body.ticket.id;

    const called = await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});
    expect(called.body.current.id).toBe(ticketId);
    expect(called.body.current.status).toBe("CALLED");

    const started = await json(
      request(app).post(`/api/tickets/${ticketId}/start`).set("Cookie", illustratorCookie),
    ).send({});
    expect(started.body.current.status).toBe("SERVING");

    const finished = await json(
      request(app).post(`/api/tickets/${ticketId}/finish`).set("Cookie", illustratorCookie),
    ).send({});
    expect(finished.status).toBe(200);
    expect(finished.body.current).toBeNull();
    const doneTicket = finished.body.recent.find((t: { id: string }) => t.id === ticketId);
    expect(doneTicket.status).toBe("DONE");
    expect(typeof doneTicket.durationSec).toBe("number");
  });

  it("finish with callNext calls the next ticket in the same request", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "Amara", phone: "081234560001" });
    const t2 = await createTicketViaApi(app, adminCookie, { name: "Budi", phone: "081234560002" });

    await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});
    await json(
      request(app).post(`/api/tickets/${t1.body.ticket.id}/start`).set("Cookie", illustratorCookie),
    ).send({});
    const finished = await json(
      request(app).post(`/api/tickets/${t1.body.ticket.id}/finish`).set("Cookie", illustratorCookie),
    ).send({ callNext: true });

    expect(finished.body.current.id).toBe(t2.body.ticket.id);
    expect(finished.body.current.status).toBe("CALLED");
  });
});

describe("call-next guards", () => {
  it("rejects when someone is already current", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    await createTicketViaApi(app, adminCookie, { name: "Amara", phone: "081234560001" });
    await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});

    const second = await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CURRENT_ACTIVE");
    expect(second.body.error.details.snapshot).toBeDefined();
  });

  it("rejects an empty queue", async () => {
    const { illustratorCookie } = await openDayViaApi(app);
    const res = await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("QUEUE_EMPTY");
  });

  it("rejects a stale expectedNextId", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    await createTicketViaApi(app, adminCookie, { name: "Amara", phone: "081234560001" });
    const res = await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({
      expectedNextId: "not-the-right-id",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_STATE");
  });

  it("exactly one of 10 concurrent call-next requests succeeds", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    await createTicketViaApi(app, adminCookie, { name: "Amara", phone: "081234560001" });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({}),
      ),
    );
    const succeeded = results.filter((r) => r.status === 200);
    const conflicted = results.filter((r) => r.status === 409);
    expect(succeeded.length).toBe(1);
    expect(conflicted.length).toBe(9);
    expect(conflicted.every((r) => r.body.error.code === "CURRENT_ACTIVE")).toBe(true);
  });
});

describe("requeue", () => {
  it("puts the ticket after N people and keeps positions 1..n", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    await createTicketViaApi(app, adminCookie, { name: "B", phone: "081234560002" });
    await createTicketViaApi(app, adminCookie, { name: "C", phone: "081234560003" });
    await createTicketViaApi(app, adminCookie, { name: "D", phone: "081234560004" });

    const called = await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});
    expect(called.body.current.id).toBe(t1.body.ticket.id);

    const requeued = await json(
      request(app).post(`/api/tickets/${t1.body.ticket.id}/requeue`).set("Cookie", illustratorCookie),
    ).send({ afterCount: 2 });
    expect(requeued.status).toBe(200);

    const waiting = requeued.body.waiting as { id: string; position: number }[];
    expect(waiting.map((t) => t.position)).toEqual([1, 2, 3, 4]);
    expect(waiting[2]?.id).toBe(t1.body.ticket.id);
  });
});

describe("no-show", () => {
  it("no-show then requeue puts the ticket back in WAITING", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});

    const noShow = await json(
      request(app).post(`/api/tickets/${t1.body.ticket.id}/no-show`).set("Cookie", illustratorCookie),
    ).send({});
    expect(noShow.status).toBe(200);
    expect(noShow.body.current).toBeNull();

    const requeued = await json(
      request(app).post(`/api/tickets/${t1.body.ticket.id}/requeue`).set("Cookie", illustratorCookie),
    ).send({});
    expect(requeued.status).toBe(200);
    expect(requeued.body.waiting[0].id).toBe(t1.body.ticket.id);
    expect(requeued.body.waiting[0].status).toBe("WAITING");
  });
});

describe("reorder", () => {
  it("writes positions 1..n in the given order", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    const t2 = await createTicketViaApi(app, adminCookie, { name: "B", phone: "081234560002" });
    const t3 = await createTicketViaApi(app, adminCookie, { name: "C", phone: "081234560003" });

    const order = [t3.body.ticket.id, t1.body.ticket.id, t2.body.ticket.id];
    const res = await json(request(app).post("/api/queue/reorder").set("Cookie", adminCookie)).send({ order });
    expect(res.status).toBe(200);
    expect(res.body.waiting.map((t: { id: string }) => t.id)).toEqual(order);
    expect(res.body.waiting.map((t: { position: number }) => t.position)).toEqual([1, 2, 3]);
  });

  it("rejects a list that adds, drops, or duplicates a ticket", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    await createTicketViaApi(app, adminCookie, { name: "B", phone: "081234560002" });

    const dropped = await json(request(app).post("/api/queue/reorder").set("Cookie", adminCookie)).send({
      order: [t1.body.ticket.id],
    });
    expect(dropped.status).toBe(409);
    expect(dropped.body.error.code).toBe("VALIDATION_ERROR");

    const duplicated = await json(request(app).post("/api/queue/reorder").set("Cookie", adminCookie)).send({
      order: [t1.body.ticket.id, t1.body.ticket.id],
    });
    expect(duplicated.status).toBe(409);

    const added = await json(request(app).post("/api/queue/reorder").set("Cookie", adminCookie)).send({
      order: [t1.body.ticket.id, "nonexistent-id"],
    });
    expect(added.status).toBe(409);
  });

  it("rejects a list invalidated by a concurrent change", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    const t2 = await createTicketViaApi(app, adminCookie, { name: "B", phone: "081234560002" });
    const staleOrder = [t2.body.ticket.id, t1.body.ticket.id];

    await json(request(app).delete(`/api/tickets/${t2.body.ticket.id}`).set("Cookie", adminCookie)).send();

    const res = await json(request(app).post("/api/queue/reorder").set("Cookie", adminCookie)).send({
      order: staleOrder,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("customer cancel", () => {
  it("cancels from WAITING", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    const token = tokenFromCustomerUrl(t1.body.ticket.customerUrl);

    const res = await json(request(app).post(`/api/public/tickets/${token}/cancel`)).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
  });

  it("cancels from CALLED", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});
    const token = tokenFromCustomerUrl(t1.body.ticket.customerUrl);

    const res = await json(request(app).post(`/api/public/tickets/${token}/cancel`)).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
  });

  it("rejects cancel from SERVING with 409", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});
    await json(
      request(app).post(`/api/tickets/${t1.body.ticket.id}/start`).set("Cookie", illustratorCookie),
    ).send({});
    const token = tokenFromCustomerUrl(t1.body.ticket.customerUrl);

    const res = await json(request(app).post(`/api/public/tickets/${token}/cancel`)).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("cancelling twice returns 200", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    const token = tokenFromCustomerUrl(t1.body.ticket.customerUrl);

    const first = await json(request(app).post(`/api/public/tickets/${token}/cancel`)).send({});
    expect(first.status).toBe(200);
    const second = await json(request(app).post(`/api/public/tickets/${token}/cancel`)).send({});
    expect(second.status).toBe(200);
  });
});

describe("rotate-token", () => {
  it("old token 404s, new token works", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    const oldToken = tokenFromCustomerUrl(t1.body.ticket.customerUrl);

    const rotated = await json(
      request(app).post(`/api/tickets/${t1.body.ticket.id}/rotate-token`).set("Cookie", adminCookie),
    ).send({});
    expect(rotated.status).toBe(200);
    const newToken = tokenFromCustomerUrl(rotated.body.ticket.customerUrl);
    expect(newToken).not.toBe(oldToken);

    const oldRes = await request(app).get(`/api/public/tickets/${oldToken}`);
    expect(oldRes.status).toBe(404);
    const newRes = await request(app).get(`/api/public/tickets/${newToken}`);
    expect(newRes.status).toBe(200);
  });
});

describe("public ticket view", () => {
  it("never exposes phone, notes, id, or other customers' names", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, {
      name: "Amara Putri",
      phone: "081234560001",
      notes: "very secret note",
    });
    await createTicketViaApi(app, adminCookie, { name: "Budi Santoso", phone: "081234560002" });
    const token = tokenFromCustomerUrl(t1.body.ticket.customerUrl);

    const res = await request(app).get(`/api/public/tickets/${token}`);
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(t1.body.ticket.id);
    expect(raw).not.toContain("081234560001");
    expect(raw).not.toContain("secret note");
    expect(raw).not.toMatch(/"phone"|"notes"/);
    expect(raw).not.toContain("Budi");
    expect(raw).not.toContain("Santoso");
    expect(res.body.firstName).toBe("Amara");
  });

  it("has Cache-Control: no-store", async () => {
    const { adminCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    const token = tokenFromCustomerUrl(t1.body.ticket.customerUrl);
    const res = await request(app).get(`/api/public/tickets/${token}`);
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("GET /api/queue", () => {
  it("has Cache-Control: no-store", async () => {
    const { illustratorCookie } = await openDayViaApi(app);
    const res = await request(app).get("/api/queue").set("Cookie", illustratorCookie);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("almostUp heads-up", () => {
  it("flips at the headsUpAhead threshold", async () => {
    const { adminCookie } = await openDayViaApi(app, { headsUpAhead: 3 });
    const tickets = [];
    for (let i = 0; i < 5; i++) {
      tickets.push(await createTicketViaApi(app, adminCookie, { name: `T${i}`, phone: `08123456010${i}` }));
    }

    const token4 = tokenFromCustomerUrl(tickets[3]!.body.ticket.customerUrl); // 3 ahead -> true
    const token5 = tokenFromCustomerUrl(tickets[4]!.body.ticket.customerUrl); // 4 ahead -> false

    const view4 = await request(app).get(`/api/public/tickets/${token4}`);
    const view5 = await request(app).get(`/api/public/tickets/${token5}`);
    expect(view4.body.almostUp).toBe(true);
    expect(view5.body.almostUp).toBe(false);
  });

  it("threshold 0 always disables it", async () => {
    const { adminCookie } = await openDayViaApi(app, { headsUpAhead: 0 });
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    const token = tokenFromCustomerUrl(t1.body.ticket.customerUrl);

    const view = await request(app).get(`/api/public/tickets/${token}`);
    expect(view.body.almostUp).toBe(false);
  });

  it("headsUpAhead is settable via PATCH /api/day", async () => {
    const { adminCookie } = await openDayViaApi(app, { headsUpAhead: 3 });
    const res = await json(request(app).patch("/api/day").set("Cookie", adminCookie)).send({ headsUpAhead: 0 });
    expect(res.status).toBe(200);
    expect(res.body.day.headsUpAhead).toBe(0);
  });
});

describe("pause", () => {
  it("is blocked while SERVING", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});
    await json(
      request(app).post(`/api/tickets/${t1.body.ticket.id}/start`).set("Cookie", illustratorCookie),
    ).send({});

    const res = await json(request(app).post("/api/day/pause").set("Cookie", illustratorCookie)).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CURRENT_ACTIVE");
  });

  it("blocks call-next while paused", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    await json(request(app).post("/api/day/pause").set("Cookie", illustratorCookie)).send({});

    const res = await json(request(app).post("/api/queue/call-next").set("Cookie", illustratorCookie)).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DAY_PAUSED");
  });

  it("ETA includes a timed break", async () => {
    const { adminCookie, illustratorCookie } = await openDayViaApi(app);
    const t1 = await createTicketViaApi(app, adminCookie, { name: "A", phone: "081234560001" });
    await json(request(app).post("/api/day/pause").set("Cookie", illustratorCookie)).send({ minutes: 10 });

    const token = tokenFromCustomerUrl(t1.body.ticket.customerUrl);
    const view = await request(app).get(`/api/public/tickets/${token}`);
    expect(view.body.pause.active).toBe(true);
    expect(view.body.eta.sec).toBeGreaterThanOrEqual(9 * 60);
  });
});
