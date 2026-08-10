// One active reminder policy + rule for the active period so the head's
// per-lead Remind action both renders (the `hasActiveReminderRule` gate counts
// active ReminderPolicies whose validity window covers `Report.deadline`) and
// actually dispatches (`reminders.dispatchPending` looks up an active
// ReminderRule scoped to the active report). Mirrors the proven seed-simple.ts
// deadline policy+rule shape. Fixed UUIDs (`d…9000…`, distinct from the
// `d…8000…` counter ids) keep reseed deterministic.

import {
  type PrismaClient,
  ReminderAudience,
  ReminderRuleKind,
  ReminderRuleStatus,
} from "@prisma/client";

import { ACTIVE_REPORT_ID, SEED_REPORTS } from "../support/seed-constants.js";

const REMINDER_POLICY_DEADLINE_ID = "d0000000-0000-4000-9000-000000000001";
const REMINDER_RULE_DEADLINE_ID = "d0000000-0000-4000-9000-000000000002";
const REMINDER_OFFSET_MINUTES = -1440; // fire 24h before deadline (seed-simple parity)
const REMINDER_TIMEZONE = "Europe/Moscow";
// Local copy: prisma/ deliberately depends on no workspace package.
const MS_PER_MINUTE = 60_000;

export async function seedReminders(prisma: PrismaClient): Promise<void> {
  const activeDeadline = new Date(SEED_REPORTS.active.deadline);
  // Deterministic fireAt derived from the active deadline — no wall-clock.
  const fireAt = new Date(
    activeDeadline.getTime() + REMINDER_OFFSET_MINUTES * MS_PER_MINUTE,
  );
  await prisma.reminderPolicy.create({
    data: {
      id: REMINDER_POLICY_DEADLINE_ID,
      kind: ReminderRuleKind.deadline,
      offsetMinutes: REMINDER_OFFSET_MINUTES,
      timezone: REMINDER_TIMEZONE,
      audience: ReminderAudience.LEAD_WITH_DRAFT,
      active: true,
      // validFrom ≤ active deadline, no validUntil → covers the active period.
      validFrom: new Date(SEED_REPORTS.active.periodStart),
    },
  });
  await prisma.reminderRule.create({
    data: {
      id: REMINDER_RULE_DEADLINE_ID,
      reportId: ACTIVE_REPORT_ID,
      policyId: REMINDER_POLICY_DEADLINE_ID,
      kind: ReminderRuleKind.deadline,
      fireAt,
      timezone: REMINDER_TIMEZONE,
      status: ReminderRuleStatus.active,
      version: 1,
    },
  });
}
