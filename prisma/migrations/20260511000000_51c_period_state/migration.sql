-- UFB-053 / Phase 51-C: Period state-machine column.
--
-- Adds an explicit `Report.periodState: PeriodState` enum that replaces the
-- implicit (status × archived × periodStatus) tuple. The legacy fields are
-- preserved (one-release compatibility window) and writers update both the
-- new column and the old fields atomically.
--
-- Backfill rules (no row lands in SCHEDULED — that state is reserved for
-- future periods minted by the PeriodCreator scheduler):
--   archived = true                           → ARCHIVED
--   status = 'published' AND archived = false → PUBLISHED
--   otherwise                                 → OPEN
--
-- Index mirrors the legacy `(status, periodStart desc)` shape so the
-- archive/dashboard read paths can swap in 51-B without an index gap.

-- CreateEnum
CREATE TYPE "PeriodState" AS ENUM ('scheduled', 'open', 'published', 'archived');

-- AlterTable: add the column with a safe default; the explicit backfill
-- below overrides the default where appropriate.
ALTER TABLE "Report" ADD COLUMN "periodState" "PeriodState" NOT NULL DEFAULT 'open';

-- Backfill: derive periodState from the existing tuple.
-- ARCHIVED wins over PUBLISHED wins over OPEN.
UPDATE "Report"
   SET "periodState" = 'archived'
 WHERE "archived" = true;

UPDATE "Report"
   SET "periodState" = 'published'
 WHERE "archived" = false
   AND "status" = 'published';

-- All remaining rows already have the column-level default 'open' applied
-- by ADD COLUMN; no explicit UPDATE for the OPEN branch is needed.

-- CreateIndex
CREATE INDEX "Report_periodState_periodStart_idx" ON "Report"("periodState", "periodStart" DESC);
