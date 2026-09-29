import { execSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";

const EVENTS_MIGRATION = "20260929130000_events";
const PRISMA_DIR = path.resolve(import.meta.dirname, "../prisma");
const created: string[] = [];
const tmpDirs: string[] = [];

function urlFor(dbName: string): string {
  const url = new URL(process.env.DIRECT_URL ?? "");
  url.pathname = `/${dbName}`;
  url.search = "";
  return url.toString();
}

async function createScratchDb(name: string): Promise<string> {
  await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await prisma.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  created.push(name);
  return urlFor(name);
}

// Copies the Prisma dir so migrations can be applied in two steps: everything
// before the Events migration, then the Events migration on top.
function copyPrismaDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "boothq-migrations-"));
  tmpDirs.push(dir);
  cpSync(PRISMA_DIR, path.join(dir, "prisma"), { recursive: true, filter: (src) => !src.endsWith("seed.ts") });
  return path.join(dir, "prisma");
}

function deploy(prismaDir: string, url: string): void {
  execSync(`pnpm exec prisma migrate deploy --schema "${path.join(prismaDir, "schema.prisma")}"`, {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}

afterAll(async () => {
  for (const name of created) await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

describe("Events migration backfill", () => {
  it("puts every existing Day into one ACTIVE 'First event' started at the oldest Day's open time", async () => {
    const url = await createScratchDb("boothq_migration_backfill");
    const prismaDir = copyPrismaDir();

    // Apply everything except the Events migration, then insert legacy rows.
    const migrationsDir = path.join(prismaDir, "migrations");
    cpSync(path.join(migrationsDir, EVENTS_MIGRATION), path.join(prismaDir, "..", "events-migration-aside"), {
      recursive: true,
    });
    rmSync(path.join(migrationsDir, EVENTS_MIGRATION), { recursive: true });
    deploy(prismaDir, url);

    const raw = new PrismaClient({ datasourceUrl: url });
    try {
      await raw.$executeRawUnsafe(
        `INSERT INTO "Day" ("id","status","openedAt","closedAt") VALUES
           ('d-old','CLOSED','2026-09-20 10:00','2026-09-20 18:00'),
           ('d-new','OPEN','2026-09-21 10:00',NULL)`,
      );
      await raw.$executeRawUnsafe(
        `INSERT INTO "ActionLog" ("id","dayId","action","actorRole") VALUES ('a1','d-old','OPEN_DAY','ADMIN')`,
      );

      cpSync(path.join(prismaDir, "..", "events-migration-aside"), path.join(migrationsDir, EVENTS_MIGRATION), {
        recursive: true,
      });
      expect(readdirSync(migrationsDir)).toContain(EVENTS_MIGRATION);
      deploy(prismaDir, url);

      const events = await raw.$queryRawUnsafe<{ id: string; name: string; status: string; startedAt: Date }[]>(
        `SELECT "id","name","status","startedAt" FROM "Event"`,
      );
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ name: "First event", status: "ACTIVE" });
      expect(events[0].startedAt.toISOString()).toBe("2026-09-20T10:00:00.000Z");

      const days = await raw.$queryRawUnsafe<{ id: string; eventId: string }[]>(`SELECT "id","eventId" FROM "Day"`);
      expect(days).toHaveLength(2);
      expect(days.every((d) => d.eventId === events[0].id)).toBe(true);

      const logs = await raw.$queryRawUnsafe<{ dayId: string; eventId: string | null }[]>(
        `SELECT "dayId","eventId" FROM "ActionLog"`,
      );
      expect(logs).toEqual([{ dayId: "d-old", eventId: null }]);

      // The one-ACTIVE-Event index is in place.
      await expect(
        raw.$executeRawUnsafe(`INSERT INTO "Event" ("id","name","status") VALUES ('e2','Second','ACTIVE')`),
      ).rejects.toThrow();
    } finally {
      await raw.$disconnect();
    }
  }, 90_000);

  it("creates no Event when the database has no Days", async () => {
    const url = await createScratchDb("boothq_migration_empty");
    deploy(copyPrismaDir(), url);

    const raw = new PrismaClient({ datasourceUrl: url });
    try {
      const rows = await raw.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) FROM "Event"`);
      expect(Number(rows[0].count)).toBe(0);
    } finally {
      await raw.$disconnect();
    }
  }, 90_000);
});
