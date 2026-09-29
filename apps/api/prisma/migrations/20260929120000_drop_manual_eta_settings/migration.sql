-- AlterTable
ALTER TABLE "Day" DROP COLUMN "changeoverSec",
DROP COLUMN "defaultDurationSec";

-- CreateIndex
CREATE INDEX "Ticket_startedAt_idx" ON "Ticket"("startedAt");

