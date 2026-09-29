import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { setPhotoStorage, vercelBlobStorage } from "../src/lib/photo-storage.js";
import { prisma } from "../src/lib/prisma.js";
import {
  assertInvariants,
  createFakePhotoStorage,
  createTicketViaApi,
  json,
  openDayViaApi,
  resetDb,
} from "./helpers.js";

let app: Express;
let storage: ReturnType<typeof createFakePhotoStorage>;
let admin: string;
let illustrator: string;

beforeEach(async () => {
  await resetDb();
  storage = createFakePhotoStorage();
  setPhotoStorage(storage);
  app = createApp();
  ({ adminCookie: admin, illustratorCookie: illustrator } = await openDayViaApi(app));
});

afterEach(async () => {
  setPhotoStorage(vercelBlobStorage);
  for (const day of await prisma.day.findMany()) await assertInvariants(day.id);
});

async function newTicket(name: string, n: number): Promise<{ id: string; token: string }> {
  const res = await createTicketViaApi(app, admin, { name, phone: `08123456${String(n).padStart(4, "0")}` });
  return { id: res.body.ticket.id, token: res.body.ticket.customerUrl.split("/t/")[1] };
}

// Runs the token → browser upload → confirm flow from PHOTO_TICKETS.md.
async function addPhoto(id: string, cookie = admin): Promise<request.Response> {
  const tokenRes = await json(request(app).post(`/api/tickets/${id}/photo/upload-token`).set("Cookie", cookie)).send();
  expect(tokenRes.status).toBe(200);
  storage.upload(tokenRes.body.pathname);
  return json(request(app).post(`/api/tickets/${id}/photo`).set("Cookie", cookie)).send({
    pathname: tokenRes.body.pathname,
  });
}

const post = (path: string, cookie = illustrator, body: object = {}) =>
  json(request(app).post(path).set("Cookie", cookie)).send(body);

const ticketRow = (id: string) => prisma.ticket.findUniqueOrThrow({ where: { id } });

describe("photo confirm / delete", () => {
  it("issues a token scoped to the day and ticket", async () => {
    const t = await newTicket("Ana", 1);
    const res = await post(`/api/tickets/${t.id}/photo/upload-token`, admin);
    const day = await prisma.day.findFirstOrThrow();
    expect(res.body.pathname).toMatch(new RegExp(`^days/${day.id}/${t.id}-[\\w-]{8}\\.jpg$`));
    expect(res.body.clientToken).toBeTruthy();
  });

  it("confirming a photo makes the ticket FROM_PHOTO", async () => {
    const t = await newTicket("Ana", 1);
    const res = await addPhoto(t.id);
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ mode: "FROM_PHOTO", hasPhoto: true });
    expect(res.body.snapshot.waiting[0].hasPhoto).toBe(true);
  });

  it("rejects a photo that was never uploaded, or a path for another ticket", async () => {
    const a = await newTicket("Ana", 1);
    const b = await newTicket("Ben", 2);
    const tokenRes = await post(`/api/tickets/${a.id}/photo/upload-token`, admin);
    const missing = await post(`/api/tickets/${a.id}/photo`, admin, { pathname: tokenRes.body.pathname });
    expect(missing.status).toBe(400);

    storage.upload(tokenRes.body.pathname);
    const wrongTicket = await post(`/api/tickets/${b.id}/photo`, admin, { pathname: tokenRes.body.pathname });
    expect(wrongTicket.status).toBe(400);
  });

  it("replacing a photo deletes the old one", async () => {
    const t = await newTicket("Ana", 1);
    await addPhoto(t.id);
    const first = (await ticketRow(t.id)).photoPath as string;
    await addPhoto(t.id);
    expect(storage.deleted).toEqual([first]);
    expect(storage.files.has(first)).toBe(false);
  });

  it("removing the photo before drawing sets IN_PERSON and deletes it", async () => {
    const t = await newTicket("Ana", 1);
    await addPhoto(t.id);
    const path = (await ticketRow(t.id)).photoPath as string;

    const res = await json(request(app).delete(`/api/tickets/${t.id}/photo`).set("Cookie", admin)).send();
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ mode: "IN_PERSON", hasPhoto: false });
    expect(storage.files.has(path)).toBe(false);

    const again = await json(request(app).delete(`/api/tickets/${t.id}/photo`).set("Cookie", admin)).send();
    expect(again.status).toBe(404);
  });

  it("can't remove the photo while SERVING, and only admins can remove", async () => {
    const t = await newTicket("Ana", 1);
    await addPhoto(t.id);
    const forbidden = await json(request(app).delete(`/api/tickets/${t.id}/photo`).set("Cookie", illustrator)).send();
    expect(forbidden.status).toBe(403);

    await post("/api/queue/call-next");
    const res = await json(request(app).delete(`/api/tickets/${t.id}/photo`).set("Cookie", admin)).send();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("streams the photo to staff only", async () => {
    const t = await newTicket("Ana", 1);
    expect((await request(app).get(`/api/tickets/${t.id}/photo`).set("Cookie", admin)).status).toBe(404);
    await addPhoto(t.id);
    const res = await request(app).get(`/api/tickets/${t.id}/photo`).set("Cookie", illustrator);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/jpeg");
    expect(res.headers["cache-control"]).toBe("private, max-age=300");
    expect((await request(app).get(`/api/tickets/${t.id}/photo`)).status).toBe(401);
  });

  it("deletes the photo when the ticket is removed or cancelled by the customer", async () => {
    const a = await newTicket("Ana", 1);
    const b = await newTicket("Ben", 2);
    await addPhoto(a.id);
    await addPhoto(b.id);
    await json(request(app).delete(`/api/tickets/${a.id}`).set("Cookie", admin)).send();
    await json(request(app).post(`/api/public/tickets/${b.token}/cancel`)).send();
    expect(storage.files.size).toBe(0);
  });
});

describe("photo ticket flow", () => {
  it("call-next starts a FROM_PHOTO ticket directly; finish makes it READY and deletes the photo", async () => {
    const t = await newTicket("Ana", 1);
    await addPhoto(t.id);
    const path = (await ticketRow(t.id)).photoPath as string;

    const called = await post("/api/queue/call-next");
    expect(called.status).toBe(200);
    expect(called.body.current).toMatchObject({ id: t.id, status: "SERVING" });

    const finished = await post(`/api/tickets/${t.id}/finish`);
    expect(finished.status).toBe(200);
    expect(finished.body.current).toBeNull();
    expect(finished.body.readyForPickup.map((r: { id: string }) => r.id)).toEqual([t.id]);
    expect(finished.body.stats).toMatchObject({ servedCount: 1, readyForPickupCount: 1 });

    const row = await ticketRow(t.id);
    expect(row).toMatchObject({ status: "READY", photoPath: null, mode: "FROM_PHOTO" });
    expect(row.readyAt).not.toBeNull();
    expect(row.durationSec).not.toBeNull();
    expect(storage.deleted).toContain(path);
  });

  it("finish & call next starts a following photo ticket", async () => {
    const a = await newTicket("Ana", 1);
    const b = await newTicket("Ben", 2);
    await addPhoto(b.id);
    await post("/api/queue/call-next");
    await post(`/api/tickets/${a.id}/start`);
    const res = await post(`/api/tickets/${a.id}/finish`, illustrator, { callNext: true });
    expect(res.body.current).toMatchObject({ id: b.id, status: "SERVING" });
  });

  it("start works out of order for a photo ticket only when nothing is current", async () => {
    const a = await newTicket("Ana", 1);
    const b = await newTicket("Ben", 2);
    const c = await newTicket("Cy", 3);
    await addPhoto(c.id);

    const gap = await post(`/api/tickets/${c.id}/start`);
    expect(gap.status).toBe(200);
    expect(gap.body.current.id).toBe(c.id);
    expect(gap.body.waiting.map((w: { id: string; position: number }) => [w.id, w.position])).toEqual([
      [a.id, 1],
      [b.id, 2],
    ]);

    // A walk-up can't jump the line, and nothing starts while someone is current.
    await post(`/api/tickets/${c.id}/finish`);
    expect((await post(`/api/tickets/${b.id}/start`)).status).toBe(409);
    await post("/api/queue/call-next");
    await addPhoto(b.id);
    expect((await post(`/api/tickets/${b.id}/start`)).status).toBe(409);
  });

  it("a photo added to a CALLED ticket starts normally", async () => {
    const t = await newTicket("Ana", 1);
    await post("/api/queue/call-next");
    await addPhoto(t.id);
    const res = await post(`/api/tickets/${t.id}/start`);
    expect(res.body.current.status).toBe("SERVING");
  });

  it("READY can't be called, finished or removed; picked-up moves it to DONE", async () => {
    const t = await newTicket("Ana", 1);
    await addPhoto(t.id);
    await post("/api/queue/call-next");
    await post(`/api/tickets/${t.id}/finish`);

    expect((await post(`/api/tickets/${t.id}/start`)).status).toBe(409);
    expect((await post(`/api/tickets/${t.id}/finish`)).status).toBe(409);
    expect((await post(`/api/tickets/${t.id}/no-show`)).status).toBe(409);
    expect((await json(request(app).delete(`/api/tickets/${t.id}`).set("Cookie", admin)).send()).status).toBe(409);
    expect((await post("/api/queue/call-next")).body.error.code).toBe("QUEUE_EMPTY");

    const done = await post(`/api/tickets/${t.id}/picked-up`);
    expect(done.status).toBe(200);
    expect(done.body.readyForPickup).toEqual([]);
    expect(await ticketRow(t.id)).toMatchObject({ status: "DONE" });
    expect((await ticketRow(t.id)).pickedUpAt).not.toBeNull();
    expect((await post(`/api/tickets/${t.id}/picked-up`)).status).toBe(409);
  });

  it("picked-up rejects tickets that aren't READY", async () => {
    const t = await newTicket("Ana", 1);
    expect((await post(`/api/tickets/${t.id}/picked-up`)).status).toBe(409);
  });

  it("undo of a photo finish is not offered; undo of the photo start is", async () => {
    const t = await newTicket("Ana", 1);
    await addPhoto(t.id);
    const started = await post("/api/queue/call-next");
    expect(started.body.undo.action).toBe("CALL_NEXT");
    const undone = await post("/api/queue/undo");
    expect(undone.status).toBe(200);
    expect(await ticketRow(t.id)).toMatchObject({ status: "WAITING", position: 1, mode: "FROM_PHOTO" });

    await post("/api/queue/call-next");
    const finished = await post(`/api/tickets/${t.id}/finish`);
    expect(finished.body.undo).toBeNull();
  });
});

describe("close day", () => {
  it("keeps READY, cancels other photo tickets, sweeps the day's prefix", async () => {
    const a = await newTicket("Ana", 1);
    const b = await newTicket("Ben", 2);
    await addPhoto(a.id);
    await addPhoto(b.id);
    await post("/api/queue/call-next");
    await post(`/api/tickets/${a.id}/finish`);

    const day = await prisma.day.findFirstOrThrow();
    const res = await post("/api/day/close", admin);
    expect(res.status).toBe(200);
    expect(storage.prefixesDeleted).toEqual([`days/${day.id}/`]);
    expect(storage.files.size).toBe(0);
    expect(await ticketRow(a.id)).toMatchObject({ status: "READY" });
    expect(await ticketRow(b.id)).toMatchObject({ status: "CANCELLED", cancelReason: "DAY_CLOSED", photoPath: null });

    // Pickup is still recorded after the booth closes.
    const pickup = await post(`/api/tickets/${a.id}/picked-up`);
    expect(pickup.status).toBe(200);
  });
});

describe("public view", () => {
  it("FROM_PHOTO: no heads-up, a ready ETA, no photo URL, no phone", async () => {
    const a = await newTicket("Ana Lee", 1);
    await addPhoto(a.id);
    const res = await request(app).get(`/api/public/tickets/${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mode: "FROM_PHOTO", almostUp: false, status: "WAITING" });
    expect(res.body.readyEta.sec).toBe(res.body.eta.sec + res.body.avgSessionSec);
    expect(JSON.stringify(res.body)).not.toMatch(/photoPath|photoUrl|hasPhoto|blob|days\/|0812345/i);
  });

  it("READY ticket shows READY; SERVING photo ticket has a ready ETA", async () => {
    const a = await newTicket("Ana", 1);
    await addPhoto(a.id);
    await post("/api/queue/call-next");
    const serving = await request(app).get(`/api/public/tickets/${a.token}`);
    expect(serving.body.status).toBe("SERVING");
    expect(serving.body.readyEta.sec).toBeGreaterThanOrEqual(60);

    await post(`/api/tickets/${a.id}/finish`);
    const ready = await request(app).get(`/api/public/tickets/${a.token}`);
    expect(ready.body).toMatchObject({ status: "READY", mode: "FROM_PHOTO", readyEta: null });
  });

  it("in-person tickets keep readyEta null", async () => {
    const a = await newTicket("Ana", 1);
    const res = await request(app).get(`/api/public/tickets/${a.token}`);
    expect(res.body).toMatchObject({ mode: "IN_PERSON", readyEta: null });
  });
});
