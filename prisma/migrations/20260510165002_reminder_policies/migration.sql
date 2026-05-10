-- CreateEnum
CREATE TYPE "ReminderAudience" AS ENUM ('LEAD_WITH_DRAFT', 'HEAD_OF_LATE');

-- AlterTable
ALTER TABLE "ReminderRule" ADD COLUMN     "policyId" TEXT;

-- CreateTable
CREATE TABLE "ReminderPolicy" (
    "id" TEXT NOT NULL,
    "kind" "ReminderRuleKind" NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "audience" "ReminderAudience" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderPolicy_kind_active_idx" ON "ReminderPolicy"("kind", "active");

-- CreateIndex
CREATE INDEX "ReminderPolicy_active_idx" ON "ReminderPolicy"("active");

-- CreateIndex
CREATE INDEX "ReminderRule_policyId_idx" ON "ReminderRule"("policyId");

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ReminderPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- UFB-036 / Phase 44-01 backfill
-- ---------------------------------------------------------------------------
-- Derive one ReminderPolicy per unique (kind, derived_offset_minutes, timezone)
-- where derived_offset_minutes = round((fireAt - report.deadline) / interval '1 minute').
--
-- DEVIATION FROM PLAN (Rule 3): the plan SQL references a `ReportPeriod` table
-- with a `deadline` column. The actual schema has no `ReportPeriod` model —
-- `Report.deadline` carries the period deadline directly (Report rows are the
-- period). Backfill below uses `"Report"."deadline"` as the reference instant.
-- ---------------------------------------------------------------------------
INSERT INTO "ReminderPolicy" (id, kind, "offsetMinutes", timezone, audience, active, "createdAt", "updatedAt")
SELECT DISTINCT
  gen_random_uuid(),
  r.kind,
  ROUND(EXTRACT(EPOCH FROM (r."fireAt" - rep.deadline)) / 60)::INTEGER,
  COALESCE(r.timezone, 'Europe/Moscow'),
  CASE WHEN r.kind = 'escalation' THEN 'HEAD_OF_LATE'::"ReminderAudience" ELSE 'LEAD_WITH_DRAFT'::"ReminderAudience" END,
  true,
  NOW(),
  NOW()
FROM "ReminderRule" r
JOIN "Report" rep ON rep.id = r."reportId"
WHERE r."policyId" IS NULL;

-- Set policyId on each existing rule by matching tuple
UPDATE "ReminderRule" r
SET "policyId" = p.id
FROM "ReminderPolicy" p, "Report" rep
WHERE rep.id = r."reportId"
  AND p.kind = r.kind
  AND p."offsetMinutes" = ROUND(EXTRACT(EPOCH FROM (r."fireAt" - rep.deadline)) / 60)::INTEGER
  AND p.timezone = COALESCE(r.timezone, 'Europe/Moscow')
  AND r."policyId" IS NULL;
