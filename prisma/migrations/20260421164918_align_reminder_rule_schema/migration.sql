-- Hand-edited migration: align ReminderRule schema with Zod contracts
-- Original Prisma-generated migration would DROP columns before ADD, causing data loss.
-- This version adds new columns first, converts existing data, then drops old columns.

-- Step 1: Create new enums
CREATE TYPE "ReminderRuleKind" AS ENUM ('deadline', 'follow_up');
CREATE TYPE "ReminderRuleStatus" AS ENUM ('active', 'paused');

-- Step 2: Add new columns with defaults (safe for non-empty tables)
ALTER TABLE "ReminderRule" ADD COLUMN "kind" "ReminderRuleKind" NOT NULL DEFAULT 'deadline';
ALTER TABLE "ReminderRule" ADD COLUMN "fireAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ReminderRule" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow';
ALTER TABLE "ReminderRule" ADD COLUMN "status" "ReminderRuleStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "ReminderRule" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Step 3: Convert existing data (MUST come before DROP)
UPDATE "ReminderRule" SET
  "kind" = CASE WHEN "name" ILIKE '%follow%' THEN 'follow_up'::"ReminderRuleKind" ELSE 'deadline'::"ReminderRuleKind" END,
  "status" = CASE WHEN "enabled" = true THEN 'active'::"ReminderRuleStatus" ELSE 'paused'::"ReminderRuleStatus" END;

-- Step 4: Drop old columns
ALTER TABLE "ReminderRule" DROP COLUMN "name";
ALTER TABLE "ReminderRule" DROP COLUMN "cronExpression";
ALTER TABLE "ReminderRule" DROP COLUMN "enabled";

-- Step 5: Remove default from fireAt (only needed during migration)
ALTER TABLE "ReminderRule" ALTER COLUMN "fireAt" DROP DEFAULT;
