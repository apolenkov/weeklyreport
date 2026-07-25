// Manual-UAT active period: the open report, one empty draft section per lead,
// and the reminder policies/rules that make the reminder dashboard non-empty.

import {
  PeriodState,
  PeriodStatus,
  type Prisma,
  ReminderAudience,
  ReminderRuleKind,
  ReminderRuleStatus,
  ReportSectionStatus,
  ReportStatus,
} from "@prisma/client";

import {
  ACTIVE_REPORT_ID,
  LEAD_1_ID,
  LEAD_DMITRY_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  SEED_REPORTS,
} from "./seed-constants.js";
import { FINANCE_LEAD_USER_ID } from "./wipe-manual-uat.seed-baseline.js";

// One empty draft section per primary lead so /lead/report has an open form on
// login. Finance lead also gets a section so the second group's head sees one.
const SECTION_LEAD_IDS = [
  LEAD_1_ID,
  LEAD_MARIA_ID,
  LEAD_IGOR_ID,
  LEAD_DMITRY_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  FINANCE_LEAD_USER_ID,
];

const REMINDER_TIMEZONE = "Europe/Moscow";
const DEADLINE_POLICY_ID = "a0000000-0000-4000-8000-000000000a01";
const ESCALATION_POLICY_ID = "a0000000-0000-4000-8000-000000000a02";
const DEADLINE_RULE_ID = "a0000000-0000-4000-8000-000000000801";
const ESCALATION_RULE_ID = "a0000000-0000-4000-8000-000000000802";

// The deadline reminder fires one day before the deadline; the escalation two
// hours after it. Escalation arithmetic is UTC-only, so plain millisecond
// addition is exact.
const DEADLINE_REMINDER_OFFSET_MINUTES = -1440;
const ESCALATION_OFFSET_MINUTES = 120;
const MS_PER_MINUTE = 60_000;

function createActiveReport(tx: Prisma.TransactionClient) {
  return tx.report.create({
    data: {
      id: ACTIVE_REPORT_ID,
      periodStart: new Date(SEED_REPORTS.active.periodStart),
      periodEnd: new Date(SEED_REPORTS.active.periodEnd),
      deadline: new Date(SEED_REPORTS.active.deadline),
      weekLabel: SEED_REPORTS.active.weekLabel,
      periodStatus: PeriodStatus.open,
      periodState: PeriodState.open,
      status: ReportStatus.draft,
    },
  });
}

// Sequential by design: one transaction, deterministic insert order.
async function seedLeadSections(
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<number> {
  for (const authorId of SECTION_LEAD_IDS) {
    await tx.reportSection.create({
      data: { reportId, authorId, status: ReportSectionStatus.draft },
    });
  }
  return SECTION_LEAD_IDS.length;
}

// Mirrors seed-simple.ts so the reminder dashboard has visible policy rows AND
// concrete derived rules under each policy.
async function seedReminders(tx: Prisma.TransactionClient): Promise<void> {
  const deadlineFire = new Date(SEED_REPORTS.active.deadline);
  const escalationFire = new Date(
    deadlineFire.getTime() + ESCALATION_OFFSET_MINUTES * MS_PER_MINUTE,
  );
  await tx.reminderPolicy.createMany({
    data: [
      {
        id: DEADLINE_POLICY_ID,
        kind: ReminderRuleKind.deadline,
        offsetMinutes: DEADLINE_REMINDER_OFFSET_MINUTES,
        timezone: REMINDER_TIMEZONE,
        audience: ReminderAudience.LEAD_WITH_DRAFT,
        active: true,
      },
      {
        id: ESCALATION_POLICY_ID,
        kind: ReminderRuleKind.escalation,
        timezone: REMINDER_TIMEZONE,
        offsetMinutes: ESCALATION_OFFSET_MINUTES,
        audience: ReminderAudience.HEAD_OF_LATE,
        active: true,
      },
    ],
  });
  await tx.reminderRule.createMany({
    data: [
      {
        id: DEADLINE_RULE_ID,
        reportId: ACTIVE_REPORT_ID,
        policyId: DEADLINE_POLICY_ID,
        kind: ReminderRuleKind.deadline,
        fireAt: deadlineFire,
        timezone: REMINDER_TIMEZONE,
        status: ReminderRuleStatus.active,
        version: 1,
      },
      {
        id: ESCALATION_RULE_ID,
        reportId: ACTIVE_REPORT_ID,
        policyId: ESCALATION_POLICY_ID,
        kind: ReminderRuleKind.escalation,
        fireAt: escalationFire,
        timezone: REMINDER_TIMEZONE,
        status: ReminderRuleStatus.active,
        version: 1,
      },
    ],
  });
}

export async function seedActivePeriod(tx: Prisma.TransactionClient) {
  const report = await createActiveReport(tx);
  const leadSections = await seedLeadSections(tx, report.id);
  await seedReminders(tx);

  return { report, leadSections };
}
