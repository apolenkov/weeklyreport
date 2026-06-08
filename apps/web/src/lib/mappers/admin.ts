/**
 * Translates `admin.snapshot` + `admin.getSettings` to the mock-shaped types
 * the existing admin tab components expect.
 *
 * Per CONTEXT.md migration order, used by Users, Products, Periods, Reminders,
 * and Settings tabs. The mapper is intentionally self-contained and re-declares
 * the presentation types so downstream consumers do not couple to a particular
 * UI module (`apps/web/src/components/admin/mock-data.ts`).
 *
 * R3a-4 split: the presentation types live in `admin-types.ts` and the
 * form-state→API helpers in `admin-form-inputs.ts`; this module keeps the
 * snapshot/settings read-mappers and re-exports both siblings so the mappers
 * barrel and all importers resolve through `./admin` unchanged.
 *
 * Synthesis notes (Phase 21 / Plan 21-03):
 * - `adminSnapshotSchema` does NOT carry stages or stageAssignments. We default
 *   each product to 7 empty stage rows (assigneeId: null) so ProductsTab still
 *   renders. Phase 22 wires real stage assignments via `admin.listStageAssignments`.
 * - `adminUserSchema` carries reporting group fields. The legacy
 *   `department` presentation property now renders the group name.
 * - `adminProjectSchema.archived: boolean` collapses to mock `status: 'active'|'archived'`.
 * - `reportPeriodSchema.status` is `'draft'|'published'`. We map `'draft' -> 'open'`
 *   (the schema lacks a `'reopened'` enum at this read endpoint — `periodReadModelSchema`
 *   has `periodStatus` but `admin.snapshot` returns `reportPeriodSchema`).
 * - `weekLabel` is synthesized from `periodStart` (ISO week number).
 * - `adminReminderRuleSchema` has no name/description. We synthesize from `kind`
 *   and `fireAt`.
 * - `appSettingsSchema` is a 1:1 match for `MockSettings` (autoCreatePeriods,
 *   defaultDeadlineDays + the UFB-048 knobs; UFB-047 Phase 49-01 dropped
 *   the legacy `departmentName` field).
 */

import type {
  AdminProject,
  AdminReminderRule,
  AdminSnapshot,
  AdminUser,
  AppSettings,
  ReminderPolicy,
  ReportingGroup,
  ReportPeriod,
} from "@customreport/shared";
import { STAGE_NAMES } from "@customreport/shared";

import { formatPeriodLabel } from "../format-date";
import type {
  MappedAdminSnapshot,
  MockGroup,
  MockPeriod,
  MockProduct,
  MockReminder,
  MockReminderPolicy,
  MockSettings,
  MockUser,
  PeriodStatus,
  StageAssignment,
} from "./admin-types";

export type {
  AdminProjectFormInput,
  AdminReminderPolicyFormInput,
  AdminReminderRuleFormInput,
  AdminUserFormInput,
  ReportingGroupFormInput,
  ReportPeriodFormInput,
} from "./admin-form-inputs";
export {
  toAdminProjectInput,
  toAdminReminderRuleInput,
  toAdminUserInput,
  toReminderPolicyInput,
  toReportingGroupInput,
  toReportPeriodInput,
} from "./admin-form-inputs";
export type {
  MappedAdminSnapshot,
  MockGroup,
  MockPeriod,
  MockProduct,
  MockReminder,
  MockReminderPolicy,
  MockSettings,
  MockUser,
  PeriodStatus,
  StageAssignment,
  StageName,
  UserRole,
} from "./admin-types";

// ---- Helpers ----

function emptyStageGrid(): StageAssignment[] {
  return STAGE_NAMES.map((stage) => ({ stage, assigneeId: null }));
}

/** Returns ISO week label like "Week 17" given a Date in the UTC range. */
function isoWeekLabel(date: Date): string {
  // ISO week number per ISO-8601: thursday-anchored.
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `Week ${week}`;
}

function toIsoDateString(date: Date): string {
  // YYYY-MM-DD
  return date.toISOString().slice(0, 10);
}

function mapUser(api: AdminUser): MockUser {
  return {
    id: api.id,
    name: api.name,
    email: api.email,
    role: api.role,
    groupId: api.reportingGroupId ?? "",
    department: api.reportingGroupName ?? "No owning group",
    // A2 (UAT-v7 2026-05-12): default true in case old snapshot rows lack the field.
    isActive: api.isActive,
  };
}

function mapGroup(api: ReportingGroup): MockGroup {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? null,
    archived: api.archived,
    headUserId: api.headUserId ?? null,
  };
}

function mapProject(api: AdminProject): MockProduct {
  return {
    id: api.id,
    name: api.name,
    leadOwnerId: api.leadId,
    status: api.archived ? "archived" : "active",
    // Stage assignments are loaded separately via admin.listStageAssignments
    // (Phase 22). For Phase 21 read-only migration, surface an empty 7-stage grid.
    stages: emptyStageGrid(),
  };
}

function mapPeriod(api: ReportPeriod): MockPeriod {
  // adminSnapshotSchema ships reportPeriodSchema (status: 'draft' | 'published').
  // Mock UI expects 'open' | 'published' | 'reopened'. Map 'draft' -> 'open';
  // 'reopened' is unreachable from this endpoint (only periodReadModelSchema
  // exposes periodStatus).
  const status: PeriodStatus =
    api.status === "published" ? "published" : "open";
  return {
    id: api.id,
    weekLabel: formatPeriodLabel(api.periodStart, api.periodEnd),
    startDate: toIsoDateString(api.periodStart),
    endDate: toIsoDateString(api.periodEnd),
    deadline: toIsoDateString(api.deadline),
    status,
  };
}

function reminderName(kind: AdminReminderRule["kind"]): string {
  switch (kind) {
    case "deadline":
      return "Deadline reminder";
    case "escalation":
      return "Escalation digest";
    case "follow_up":
    default:
      return "Follow-up reminder";
  }
}

function reminderDescription(rule: AdminReminderRule): string {
  const at = rule.fireAt.toISOString().replace("T", " ").slice(0, 16);
  switch (rule.kind) {
    case "deadline":
      return `Send a reminder when the deadline is reached (fires at ${at} UTC).`;
    case "escalation":
      return `Send a T+2h escalation digest to the head with all late leads (fires at ${at} UTC).`;
    case "follow_up":
    default:
      return `Send a follow-up reminder to leads who have not submitted (fires at ${at} UTC).`;
  }
}

function mapReminder(api: AdminReminderRule): MockReminder {
  return {
    id: api.id,
    name: reminderName(api.kind),
    description: reminderDescription(api),
    active: api.status === "active",
    kind: api.kind,
    fireAt: api.fireAt,
    timezone: api.timezone,
    version: api.version,
    reportId: api.reportId,
    policyId: api.policyId,
  };
}

/**
 * UFB-036 (Phase 44-04): translates `reminderPolicySchema` → presentation.
 * Field-for-field; keeps `validFrom` + `validUntil` as JS Dates so the
 * editor's date inputs can format them with one consistent helper.
 */
function mapReminderPolicy(api: ReminderPolicy): MockReminderPolicy {
  return {
    id: api.id,
    kind: api.kind,
    offsetMinutes: api.offsetMinutes,
    timezone: api.timezone,
    audience: api.audience,
    active: api.active,
    validFrom: api.validFrom,
    validUntil: api.validUntil,
  };
}

// ---- Public mappers ----

/**
 * Translates `admin.snapshot` API output into the slices each admin tab needs.
 *
 * The Reminder enum mapping follows PITFALLS Pitfall 1:
 *   apiStatus === 'active' => mock.active === true
 *   apiStatus === 'paused' => mock.active === false
 */
export function mapAdminSnapshot(api: AdminSnapshot): MappedAdminSnapshot {
  return {
    groups: api.groups.map(mapGroup),
    users: api.users.map(mapUser),
    products: api.projects.map(mapProject),
    periods: api.periods.map(mapPeriod),
    reminders: api.reminderRules.map(mapReminder),
    // UFB-036 (Phase 44-04): policies are emitted by `admin.snapshot`
    // (default `[]` keeps older / in-memory test snapshots compatible).
    policies: api.policies.map(mapReminderPolicy),
  };
}

/**
 * Translates `admin.getSettings` API output into the SettingsTab presentation
 * shape. Field-for-field copy — `appSettingsSchema` and `MockSettings` stay
 * structurally identical (Phase 49-01: `departmentName` dropped on both
 * sides at the same time).
 */
export function mapAdminSettings(api: AppSettings): MockSettings {
  return {
    autoCreatePeriods: api.autoCreatePeriods,
    defaultDeadlineDays: api.defaultDeadlineDays,
    // UFB-048 (Phase 48-B): pass-through for the 9 new fields. The wire
    // schema fills defaults so older API responses still parse cleanly.
    periodLengthDays: api.periodLengthDays,
    workingDays: api.workingDays,
    gracePeriodHours: api.gracePeriodHours,
    allowLateSubmissions: api.allowLateSubmissions,
    autoPublishAfterDeadline: api.autoPublishAfterDeadline,
    autoArchiveWeeksAfterPublish: api.autoArchiveWeeksAfterPublish,
    firstDayOfWeek: api.firstDayOfWeek,
    deadlineDayOfWeek: api.deadlineDayOfWeek,
    deadlineTime: api.deadlineTime,
    maxOpenPeriods: api.maxOpenPeriods,
    requireAllSectionsToPublish: api.requireAllSectionsToPublish,
    allowReopenAfterPublish: api.allowReopenAfterPublish,
    reopenWindowHours: api.reopenWindowHours,
    defaultTimezone: api.defaultTimezone,
    defaultReminderAudience: api.defaultReminderAudience,
    notificationFromEmail: api.notificationFromEmail,
  };
}

// Internal exports for tests — keep narrow.
export const __testing = {
  mapReminder,
  mapReminderPolicy,
  mapPeriod,
  mapProject,
  mapUser,
  mapGroup,
  isoWeekLabel,
};
