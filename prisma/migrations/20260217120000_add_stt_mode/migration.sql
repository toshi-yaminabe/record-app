-- AlterTable: add STT mode columns to segments
ALTER TABLE "segments" ADD COLUMN "selected_mode" TEXT;
ALTER TABLE "segments" ADD COLUMN "executed_mode" TEXT;
ALTER TABLE "segments" ADD COLUMN "fallback_reason" TEXT;
ALTER TABLE "segments" ADD COLUMN "local_engine_version" TEXT;

-- Backfill: existing rows default to SERVER
UPDATE "segments" SET "selected_mode" = 'SERVER', "executed_mode" = 'SERVER'
WHERE "selected_mode" IS NULL;

-- Index: mode-based KPI queries
CREATE INDEX "segments_selected_mode_idx" ON "segments"("selected_mode");
CREATE INDEX "segments_executed_mode_idx" ON "segments"("executed_mode");
