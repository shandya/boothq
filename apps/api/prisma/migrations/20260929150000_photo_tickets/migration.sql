-- CreateEnum
CREATE TYPE "TicketMode" AS ENUM ('IN_PERSON', 'FROM_PHOTO');

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'READY';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "mode" "TicketMode" NOT NULL DEFAULT 'IN_PERSON',
ADD COLUMN     "photoPath" TEXT,
ADD COLUMN     "photoUploadedAt" TIMESTAMP(3),
ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "readyAt" TIMESTAMP(3);
