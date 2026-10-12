import {
  type PrismaClient,
  ReminderAudience,
  ReminderRuleKind,
  ReminderRuleStatus,
  ReopenRequestStatus,
  Role,
  UserActionStatus,
} from "@prisma/client";
import { computeReminderFireAt } from "@weeklyreport/shared";

import {
  ADMIN_ID,
  DEFAULT_REPORTING_GROUP_ID,
  HEAD_ID,
  LEAD_MARIA,
  POLICY_DEADLINE,
  POLICY_ESCALATION,
  REPORT_ACTIVE,
  REPORT_PUBLISHED,
  VIEWER_ID,
} from "./seed-simple.ids.js";
import { ACTIVE_FRIDAY_DEADLINE, ACTIVE_MONDAY } from "./seed-simple.period.js";

const SEED_TIMEZONE = "Europe/Moscow";
// Deadline reminder fires 24h before the deadline; escalation 2h after it.
const DEADLINE_OFFSET_MINUTES = -1440;
const ESCALATION_OFFSET_MINUTES = 120;

// Backfills the seed group's headUserId and grants the viewer access, so the
// dashboard renders with a configured leader and a viewer who already sees the
// group's reports.
export async function seedGroupLeaderAndViewer(
  prisma: PrismaClient,
): Promise<void> {
  console.log("[seed-simple] Setting group leader + viewer access...");
  await prisma.reportingGroup.update({
    where: { id: DEFAULT_REPORTING_GROUP_ID },
    data: { headUserId: HEAD_ID },
  });
  await prisma.viewerGroupAccess.create({
    data: {
      id: "a0000000-0000-4000-8000-000000000901",
      viewerUserId: VIEWER_ID,
      groupId: DEFAULT_REPORTING_GROUP_ID,
    },
  });
}

// Targets Maria's current submitted-week section so Admin → Reopen has an
// actionable pending row.
export async function seedReopenRequest(prisma: PrismaClient): Promise<void> {
  console.log(
    "[seed-simple] Creating one reopen request for Admin → Reopen...",
  );
  await prisma.reopenRequest.create({
    data: {
      id: "a0000000-0000-4000-8000-000000000d01",
      reportSectionId: "a0000000-0000-4000-8000-000000000402",
      requestedById: LEAD_MARIA,
      reason:
        "Нужно уточнить перенос работ по авторизации после комментариев head review.",
      status: ReopenRequestStatus.pending,
    },
  });
}

const ACTION_LOG_PROCEDURES = [
  "admin.updateSettings",
  "review.publish",
  "admin.updateUser",
  "leadForm.saveDraft",
] as const;
const ACTION_LOG_ROW_COUNT = 22;
const ACTION_LOG_FAILURE_INTERVAL = 7;
const ACTION_LOG_BASE_DURATION_MS = 30;
const ACTION_LOG_REFERENCE_YEAR = 2026;
const ACTION_LOG_REFERENCE_MONTH_INDEX = 7;
const ACTION_LOG_REFERENCE_DAY = 14;
const ACTION_LOG_REFERENCE_HOUR = 12;

// Two pages of deterministic, profile-owned events make the Action Log cursor
// transition executable without relying on external database residue.
export const ACTION_LOG_ROWS = Array.from(
  { length: ACTION_LOG_ROW_COUNT },
  (_, index) => {
    const ordinal = index + 1;
    const procedure =
      ACTION_LOG_PROCEDURES[index % ACTION_LOG_PROCEDURES.length] ??
      "admin.updateSettings";
    const failed = ordinal % ACTION_LOG_FAILURE_INTERVAL === 0;
    const isHeadAction = procedure === "review.publish";
    return {
      id: `a0000000-0000-4000-8000-000000000e${String(ordinal).padStart(2, "0")}`,
      userId: isHeadAction ? HEAD_ID : ADMIN_ID,
      role: isHeadAction ? Role.head : Role.admin,
      procedure,
      targetId: isHeadAction ? REPORT_PUBLISHED : "singleton",
      status: failed ? UserActionStatus.fail : UserActionStatus.success,
      reason: failed ? "BAD_REQUEST" : null,
      ip: "127.0.0.1",
      correlationId: `seed-simple-action-${String(ordinal).padStart(2, "0")}`,
      durationMs: ACTION_LOG_BASE_DURATION_MS + ordinal,
      createdAt: new Date(
        Date.UTC(
          ACTION_LOG_REFERENCE_YEAR,
          ACTION_LOG_REFERENCE_MONTH_INDEX,
          ACTION_LOG_REFERENCE_DAY,
          ACTION_LOG_REFERENCE_HOUR,
          -index,
        ),
      ),
    };
  },
);

// The product seed's action-log examples are exactly these deterministic rows,
// so a post-seed journey can assert profile-owned existence instead of trusting
// unrelated residue.
export const ACTION_LOG_IDS = ACTION_LOG_ROWS.map((row) => row.id);

// Reminder policies owned by the product seed (the advanced writer re-upserts the same
// two ids), used by the journey to scope the existence check to this seed.
export const REMINDER_POLICY_IDS = [
  POLICY_DEADLINE,
  POLICY_ESCALATION,
] as const;

export async function seedActionLog(prisma: PrismaClient): Promise<void> {
  console.log("[seed-simple] Creating action-log examples...");
  await prisma.userActionLog.createMany({ data: ACTION_LOG_ROWS });
}

const REMINDER_POLICY_ROWS = [
  {
    id: POLICY_DEADLINE,
    kind: ReminderRuleKind.deadline,
    offsetMinutes: DEADLINE_OFFSET_MINUTES,
    timezone: SEED_TIMEZONE,
    audience: ReminderAudience.LEAD_WITH_DRAFT,
    active: true,
    validFrom: ACTIVE_MONDAY,
  },
  {
    id: POLICY_ESCALATION,
    kind: ReminderRuleKind.escalation,
    offsetMinutes: ESCALATION_OFFSET_MINUTES,
    timezone: SEED_TIMEZONE,
    audience: ReminderAudience.HEAD_OF_LATE,
    active: true,
    validFrom: ACTIVE_MONDAY,
  },
];

const REMINDER_RULE_ROWS = [
  {
    id: "a0000000-0000-4000-8000-000000000801",
    reportId: REPORT_ACTIVE,
    policyId: POLICY_DEADLINE,
    kind: ReminderRuleKind.deadline,
    fireAt: computeReminderFireAt(
      ACTIVE_FRIDAY_DEADLINE,
      DEADLINE_OFFSET_MINUTES,
    ),
    deadline: ACTIVE_FRIDAY_DEADLINE,
    timezone: SEED_TIMEZONE,
    status: ReminderRuleStatus.active,
    version: 1,
  },
  {
    id: "a0000000-0000-4000-8000-000000000802",
    reportId: REPORT_ACTIVE,
    policyId: POLICY_ESCALATION,
    kind: ReminderRuleKind.escalation,
    fireAt: computeReminderFireAt(
      ACTIVE_FRIDAY_DEADLINE,
      ESCALATION_OFFSET_MINUTES,
    ),
    deadline: ACTIVE_FRIDAY_DEADLINE,
    timezone: SEED_TIMEZONE,
    status: ReminderRuleStatus.active,
    version: 1,
  },
];

export async function seedReminderPolicies(
  prisma: PrismaClient,
): Promise<void> {
  console.log("[seed-simple] Creating reminder policies + derived rules...");
  await prisma.reminderPolicy.createMany({ data: REMINDER_POLICY_ROWS });
  await prisma.reminderRule.createMany({ data: REMINDER_RULE_ROWS });
}
