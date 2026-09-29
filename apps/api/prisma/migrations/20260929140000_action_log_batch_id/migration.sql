-- Rows written by one request that Undo must reverse together
-- (Finish & call next writes a FINISH row and a CALL_NEXT row).
ALTER TABLE "ActionLog" ADD COLUMN "batchId" TEXT;
