-- Events group the Days at one venue (docs/EVENTS.md). Existing installs get
-- one ACTIVE "First event" that owns every existing Day, so their measured
-- wait-time history carries over.

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- Only one Event may be ACTIVE at a time (see docs/EVENTS.md)
CREATE UNIQUE INDEX "Event_one_active" ON "Event" ("status") WHERE "status" = 'ACTIVE';

-- AlterTable: Day.eventId is added nullable, backfilled, then made required
ALTER TABLE "Day" ADD COLUMN "eventId" TEXT;

INSERT INTO "Event" ("id", "name", "status", "startedAt")
SELECT 'evt_' || md5(random()::text || clock_timestamp()::text), 'First event', 'ACTIVE', MIN("openedAt")
FROM "Day"
HAVING COUNT(*) > 0;

UPDATE "Day" SET "eventId" = (SELECT "id" FROM "Event" LIMIT 1) WHERE "eventId" IS NULL;

ALTER TABLE "Day" ALTER COLUMN "eventId" SET NOT NULL;

-- AlterTable: Event operations log with eventId and no dayId
ALTER TABLE "ActionLog" ADD COLUMN "eventId" TEXT,
ALTER COLUMN "dayId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Day_eventId_idx" ON "Day"("eventId");

-- CreateIndex
CREATE INDEX "ActionLog_eventId_createdAt_idx" ON "ActionLog"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "Day" ADD CONSTRAINT "Day_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
