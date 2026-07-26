import type { PrismaClient } from "@prisma/client";
import {
  ReminderAudience,
  ReminderRuleKind,
  ReminderRuleStatus,
} from "@prisma/client";

import {
  ACTIVE_PERIOD_START,
  MOSCOW_TIMEZONE,
} from "./seed-advanced.period.js";
import { SEED_REPORTS } from "./seed-constants.js";

const activeReport = SEED_REPORTS.active;
const activeDeadline = new Date(activeReport.deadline);

const MINUTES_PER_HOUR = 60;
const HOURS_BEFORE_DEADLINE = 24;
const HOURS_AFTER_DEADLINE = 2;
const RULE_VERSION = 1;

// setUTCHours rolls the date over on its own, so out-of-range hours are fine.
const shiftHours = (from: Date, hours: number): Date => {
  const at = new Date(from);
  at.setUTCHours(at.getUTCHours() + hours);
  return at;
};

const DEADLINE_POLICY = {
  id: "a0000000-0000-4000-8000-000000000a01",
  kind: ReminderRuleKind.deadline,
  offsetMinutes: -HOURS_BEFORE_DEADLINE * MINUTES_PER_HOUR,
  timezone: MOSCOW_TIMEZONE,
  audience: ReminderAudience.LEAD_WITH_DRAFT,
  active: true,
  validFrom: ACTIVE_PERIOD_START,
  validUntil: null,
};

const ESCALATION_POLICY = {
  id: "a0000000-0000-4000-8000-000000000a02",
  kind: ReminderRuleKind.escalation,
  offsetMinutes: HOURS_AFTER_DEADLINE * MINUTES_PER_HOUR,
  timezone: MOSCOW_TIMEZONE,
  audience: ReminderAudience.HEAD_OF_LATE,
  active: true,
  validFrom: ACTIVE_PERIOD_START,
  validUntil: null,
};

const POLICIES = [DEADLINE_POLICY, ESCALATION_POLICY];

const RULES = [
  {
    id: "a0000000-0000-4000-8000-00000000c001",
    kind: ReminderRuleKind.deadline,
    fireAt: shiftHours(activeDeadline, -HOURS_BEFORE_DEADLINE),
    timezone: MOSCOW_TIMEZONE,
    status: ReminderRuleStatus.active,
    version: RULE_VERSION,
    reportId: activeReport.id,
    policyId: DEADLINE_POLICY.id,
  },
  {
    id: "a0000000-0000-4000-8000-00000000c002",
    kind: ReminderRuleKind.escalation,
    fireAt: shiftHours(activeDeadline, HOURS_AFTER_DEADLINE),
    timezone: MOSCOW_TIMEZONE,
    status: ReminderRuleStatus.active,
    version: RULE_VERSION,
    reportId: activeReport.id,
    policyId: ESCALATION_POLICY.id,
  },
];

async function seedPolicies(prisma: PrismaClient): Promise<number> {
  for (const { id, ...fields } of POLICIES) {
    await prisma.reminderPolicy.upsert({
      where: { id },
      update: fields,
      create: { id, ...fields },
    });
  }
  return POLICIES.length;
}

// Upsert by the natural key (reportId, policyId), not the surrogate id: the
// reset-hard baseline already created a rule for this pair under a different
// id, so an id-keyed upsert would CREATE a duplicate and violate the unique
// constraint (P2002).
async function seedRules(prisma: PrismaClient): Promise<number> {
  for (const rule of RULES) {
    await prisma.reminderRule.upsert({
      where: {
        reportId_policyId: { reportId: rule.reportId, policyId: rule.policyId },
      },
      update: {
        kind: rule.kind,
        fireAt: rule.fireAt,
        timezone: rule.timezone,
        status: rule.status,
        version: rule.version,
        reportId: rule.reportId,
        policyId: rule.policyId,
      },
      create: rule,
    });
  }
  return RULES.length;
}

/** Seeds the active report's reminder policies and their scheduled rules. */
export async function seedReminders(
  prisma: PrismaClient,
): Promise<{ policies: number; rules: number }> {
  return {
    policies: await seedPolicies(prisma),
    rules: await seedRules(prisma),
  };
}
