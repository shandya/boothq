import type { Express } from "express";
import request from "supertest";
import type { PhotoStorage } from "../src/lib/photo-storage.js";
import { prisma } from "../src/lib/prisma.js";

export const TEST_PINS = { ADMIN: "111111", ILLUSTRATOR: "222222" } as const;

export const TEST_EVENT_NAME = "Test event";

// Leaves one ACTIVE Event behind, because a Day can't be opened without one;
// tests about "no event running" delete it themselves.
export async function resetDb(): Promise<void> {
  await prisma.actionLog.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.day.deleteMany();
  await prisma.event.deleteMany();
  await prisma.event.create({ data: { name: TEST_EVENT_NAME } });
}

// docs/EVENTS.md → Invariants. (3, "no start/end while a Day is OPEN", is an
// operation rule checked by the tests that attempt it.)
export async function assertEventInvariants(): Promise<void> {
  const active = await prisma.event.findMany({ where: { status: "ACTIVE" } });
  if (active.length > 1) {
    throw new Error(`invariant violated: ${active.length} Events are ACTIVE at once`);
  }

  const openDay = await prisma.day.findFirst({ where: { status: "OPEN" }, include: { event: true } });
  if (openDay && openDay.event.status !== "ACTIVE") {
    throw new Error("invariant violated: the OPEN Day belongs to an Event that is not ACTIVE");
  }

  const events = await prisma.event.findMany();
  for (const e of events) {
    if ((e.status === "ENDED") !== (e.endedAt != null)) {
      throw new Error(`invariant violated: Event ${e.id} status ${e.status} endedAt ${e.endedAt}`);
    }
  }
}

// Checks the invariants in docs/DATA_MODEL.md that can be verified from
// stored state alone (invariant 6, "created only while OPEN", is enforced
// structurally by the service layer instead).
export async function assertInvariants(dayId: string): Promise<void> {
  await assertEventInvariants();

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
    const shouldHaveDuration = t.status === "DONE" || t.status === "READY";
    if (shouldHaveDuration !== (t.durationSec != null)) {
      throw new Error(`invariant violated: ticket ${t.id} status ${t.status} durationSec ${t.durationSec}`);
    }
    // docs/PHOTO_TICKETS.md → Invariant updates
    if (["WAITING", "CALLED", "SERVING"].includes(t.status) && (t.mode === "FROM_PHOTO") !== (t.photoPath != null)) {
      throw new Error(`invariant violated: ticket ${t.id} mode ${t.mode} photoPath ${t.photoPath}`);
    }
  }

  if (day.pausedAt && tickets.some((t) => t.status === "SERVING")) {
    throw new Error("invariant violated: Day paused while a ticket is SERVING");
  }
}

export async function loginCookie(app: Express, role: keyof typeof TEST_PINS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send({ role, pin: TEST_PINS[role] });
  const setCookie = res.headers["set-cookie"];
  if (res.status !== 200 || !setCookie) {
    throw new Error(`login as ${role} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookie.split(";")[0];
}

// Every mutating request needs this per csrfProtection; a plain
// supertest .send(body) only sets it automatically when a body is given.
export function json(req: request.Test): request.Test {
  return req.set("Content-Type", "application/json");
}

export async function openDayViaApi(
  app: Express,
  body: { headsUpAhead?: number } = {},
): Promise<{ adminCookie: string; illustratorCookie: string }> {
  const adminCookie = await loginCookie(app, "ADMIN");
  const illustratorCookie = await loginCookie(app, "ILLUSTRATOR");
  const res = await json(request(app).post("/api/day/open").set("Cookie", adminCookie)).send(body);
  if (res.status !== 200) {
    throw new Error(`open day failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { adminCookie, illustratorCookie };
}

export async function createTicketViaApi(
  app: Express,
  cookie: string,
  input: { name: string; phone: string; notes?: string; force?: boolean },
): Promise<request.Response> {
  return json(request(app).post("/api/tickets").set("Cookie", cookie)).send(input);
}

// In-memory stand-in for the Vercel Blob store. `upload` plays the browser's
// direct-to-storage upload; the API never sees the bytes.
export function createFakePhotoStorage(): PhotoStorage & {
  files: Map<string, Uint8Array>;
  upload(pathname: string, bytes?: Uint8Array): void;
  deleted: string[];
  prefixesDeleted: string[];
} {
  const files = new Map<string, Uint8Array>();
  const deleted: string[] = [];
  const prefixesDeleted: string[] = [];
  return {
    files,
    deleted,
    prefixesDeleted,
    upload(pathname, bytes = new Uint8Array([0xff, 0xd8, 0xff])) {
      files.set(pathname, bytes);
    },
    async createUploadToken(pathname) {
      return { clientToken: `token-for:${pathname}` };
    },
    async exists(pathname) {
      return files.has(pathname);
    },
    async read(pathname) {
      const bytes = files.get(pathname);
      if (!bytes) return null;
      return {
        contentType: "image/jpeg",
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
      };
    },
    async delete(pathnames) {
      for (const p of pathnames) {
        files.delete(p);
        deleted.push(p);
      }
    },
    async deletePrefix(prefix) {
      prefixesDeleted.push(prefix);
      for (const key of [...files.keys()]) if (key.startsWith(prefix)) files.delete(key);
    },
  };
}
