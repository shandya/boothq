-- CreateEnum
CREATE TYPE "DayStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('WAITING', 'CALLED', 'SERVING', 'DONE', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CancelReason" AS ENUM ('CUSTOMER', 'ADMIN_REMOVED', 'DAY_CLOSED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ILLUSTRATOR', 'CUSTOMER', 'SYSTEM');

-- CreateTable
CREATE TABLE "Day" (
    "id" TEXT NOT NULL,
    "status" "DayStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "acceptingTickets" BOOLEAN NOT NULL DEFAULT true,
    "defaultDurationSec" INTEGER NOT NULL DEFAULT 600,
    "changeoverSec" INTEGER NOT NULL DEFAULT 60,
    "headsUpAhead" INTEGER NOT NULL DEFAULT 3,
    "pausedAt" TIMESTAMP(3),
    "pauseUntil" TIMESTAMP(3),
    "pauseReason" TEXT,

    CONSTRAINT "Day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "token" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'WAITING',
    "position" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "calledAt" TIMESTAMP(3),
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" "CancelReason",

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "ticketId" TEXT,
    "action" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Day_status_idx" ON "Day"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_token_key" ON "Ticket"("token");

-- CreateIndex
CREATE INDEX "Ticket_dayId_status_position_idx" ON "Ticket"("dayId", "status", "position");

-- CreateIndex
CREATE INDEX "Ticket_phone_idx" ON "Ticket"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_dayId_number_key" ON "Ticket"("dayId", "number");

-- CreateIndex
CREATE INDEX "ActionLog_dayId_createdAt_idx" ON "ActionLog"("dayId", "createdAt");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only one Day may be OPEN at a time (see docs/DATA_MODEL.md)
CREATE UNIQUE INDEX "one_open_day" ON "Day" ("status") WHERE "status" = 'OPEN';
