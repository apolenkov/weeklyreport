-- UFB-051 / Phase 51-A: Period model expansion.
--
-- AppSettings gains eight new org-wide knobs that describe how a period
-- is anchored on the calendar (`firstDayOfWeek`, `deadlineDayOfWeek`,
-- `deadlineTime`, `periodCadence`), how concurrency works
-- (`maxOpenPeriods`), and how publish/reopen gating behaves
-- (`requireAllSectionsToPublish`, `allowReopenAfterPublish`,
-- `reopenWindowHours`). All columns carry SQL defaults so the singleton
-- row updates in-place — no hand-written backfill needed (the column-level
-- DEFAULT applies to existing rows on ADD COLUMN).
--
-- Report gains `autoPublished` + `autoArchived` lifecycle audit flags so
-- the state-machine dashboard (51-B / 51-C) can distinguish AutoPublisher
-- / AutoArchiver actions from explicit head clicks.
--
-- Consumers (PeriodCreator cadence/maxOpenPeriods read, publish gating,
-- reopen window enforcement) ship in Phase 51-C — 51-A is persistence +
-- Settings UI only (mirrors the 48-B `autoPublishAfterDeadline` pattern).
--
-- `periodCadence` is TEXT (not a Postgres enum) on purpose: future
-- cadences (monthly, quarterly, ...) extend the zod wire enum without
-- requiring a new Prisma migration + `ALTER TYPE`.

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "allowReopenAfterPublish" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deadlineDayOfWeek" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "deadlineTime" TEXT NOT NULL DEFAULT '18:00',
ADD COLUMN     "firstDayOfWeek" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "maxOpenPeriods" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "periodCadence" TEXT NOT NULL DEFAULT 'weekly',
ADD COLUMN     "reopenWindowHours" INTEGER NOT NULL DEFAULT 72,
ADD COLUMN     "requireAllSectionsToPublish" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "autoArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoPublished" BOOLEAN NOT NULL DEFAULT false;
