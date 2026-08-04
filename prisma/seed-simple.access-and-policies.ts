import {
  type PrismaClient,
  ReminderAudience,
  ReminderRuleKind,
  ReminderRuleStatus,
  ReopenRequestStatus,
  Role,
  UserActionStatus,
} from "@prisma/client";

import {
  ADMIN_ID,
  DEFAULT_REPORTING_GROUP_ID,
  HEAD_ID,
  LEAD_1,
  POLICY_DEADLINE,
  POLICY_ESCALATION,
  REPORT_ACTIVE,
  REPORT_PUBLISHED,
  VIEWER_ID,
} from "./seed-simple.ids.js";
import {
  ACTIVE_MONDAY,
  ACTIVE_REMINDER_DEADLINE_FIRE,
  ACTIVE_REMINDER_ESCALATION_FIRE,
} from "./seed-simple.period.js";

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

// Targets Vasily's published-week section so Admin → Reopen has a pending row.
export async function seedReopenRequest(prisma: PrismaClient): Promise<void> {
  console.log(
    "[seed-simple] Creating one reopen request for Admin → Reopen...",
  );
  await prisma.reopenRequest.create({
    data: {
      id: "a0000000-0000-4000-8000-000000000d01",
      reportSectionId: "a0000000-0000-4000-8000-000000000411",
      requestedById: LEAD_1,
      reason:
        "Нужно уточнить перенос работ по авторизации после комментариев head review.",
      status: ReopenRequestStatus.pending,
    },
  });
}

const ACTION_LOG_ROWS = [
  {
    id: "a0000000-0000-4000-8000-000000000e01",
    userId: ADMIN_ID,
    role: Role.admin,
    procedure: "admin.updateSettings",
    targetId: "singleton",
    status: UserActionStatus.success,
    reason: "Seeded demo action: settings viewed during MVP UAT.",
    ip: "127.0.0.1",
    correlationId: "seed-simple-settings",
    durationMs: 42,
  },
  {
    id: "a0000000-0000-4000-8000-000000000e02",
    userId: HEAD_ID,
    role: Role.head,
    procedure: "review.publish",
    targetId: REPORT_PUBLISHED,
    status: UserActionStatus.success,
    reason: "Seeded demo action: previous weekly report published.",
    ip: "127.0.0.1",
    correlationId: "seed-simple-publish",
    durationMs: 86,
  },
];

// The full profile's action-log examples are exactly these deterministic rows,
// so a post-seed journey can assert profile-owned existence instead of trusting
// unrelated residue.
export const ACTION_LOG_IDS = ACTION_LOG_ROWS.map((row) => row.id);

// Reminder policies the full profile owns (advanced seed re-upserts the same
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
    fireAt: ACTIVE_REMINDER_DEADLINE_FIRE,
    timezone: SEED_TIMEZONE,
    status: ReminderRuleStatus.active,
    version: 1,
  },
  {
    id: "a0000000-0000-4000-8000-000000000802",
    reportId: REPORT_ACTIVE,
    policyId: POLICY_ESCALATION,
    kind: ReminderRuleKind.escalation,
    fireAt: ACTIVE_REMINDER_ESCALATION_FIRE,
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
