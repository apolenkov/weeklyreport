-- AlterEnum
ALTER TYPE "ReminderRuleKind" ADD VALUE 'escalation';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationOptOut" BOOLEAN NOT NULL DEFAULT false;
