-- UFB-048 / Phase 48-B: AppSettings expansion — nine new org-wide knobs.
--
-- All columns ship with SQL defaults so the existing singleton row updates
-- in-place without a manual data migration. notificationFromEmail is the
-- single nullable column (no sensible default for an email).
--
-- Semantics (also documented in schema.prisma):
--   - workingDays                : metadata-only in v1 (UI hint).
--   - gracePeriodHours +
--     allowLateSubmissions       : late-submission window after deadline.
--   - autoPublishAfterDeadline   : scheduler logic deferred — the toggle is
--                                  persisted now so the UI exists; the cron
--                                  consumer arrives in a follow-up plan.

-- CreateEnum
CREATE TYPE "WorkingDays" AS ENUM ('MON_FRI', 'MON_SAT', 'MON_SUN');

-- AlterTable
ALTER TABLE "AppSettings"
  ADD COLUMN "periodLengthDays" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "workingDays" "WorkingDays" NOT NULL DEFAULT 'MON_FRI',
  ADD COLUMN "gracePeriodHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "defaultTimezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
  ADD COLUMN "defaultReminderAudience" "ReminderAudience" NOT NULL DEFAULT 'LEAD_WITH_DRAFT',
  ADD COLUMN "notificationFromEmail" TEXT,
  ADD COLUMN "allowLateSubmissions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "autoPublishAfterDeadline" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoArchiveWeeksAfterPublish" INTEGER NOT NULL DEFAULT 0;
