/**
 * Translates `admin.snapshot` + `admin.getSettings` to the presentation types
 * consumed by the admin tabs.
 *
 * Used by the Users, Products, Periods, Reminders, and Settings tabs. The
 * mapper is intentionally self-contained so downstream consumers depend on
 * the feature model rather than a particular UI module.
 *
 * The presentation types live in `admin-types.ts` and the form-state→API
 * helpers in `admin-form-inputs.ts`; this module keeps the snapshot/settings
 * read-mappers and re-exports both siblings so all importers resolve through
 * `./admin` unchanged.
 *
 * Field-mapping notes:
 * - `adminSnapshotSchema` does NOT carry stages or stageAssignments. We default
 *   each product to 7 empty stage rows (assigneeId: null) so ProductsTab still
 *   renders. Real stage assignments are wired separately via `admin.listStageAssignments`.
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
 *   defaultDeadlineDays + the added period/reminder knobs; the legacy
 *   `departmentName` field was dropped on both sides).
 */

import type {
  AdminProject,
  AdminSnapshot,
  AdminUser,
  AppSettings,
  ReminderPolicy,
  ReportingGroup,
  ReportPeriod,
} from "@customreport/shared";
import { STAGE_NAMES } from "@customreport/shared";

import { formatPeriodLabel } from "../../../lib/format-date";
import { mapReminder } from "./admin-reminder-mapper";
import type {
  MappedAdminSnapshot,
  MockGroup,
  MockPeriod,
  MockProduct,
  MockReminderPolicy,
  MockSettings,
  MockUser,
  PeriodStatus,
  StageAssignment,
} from "./admin-types";

export type { AdminReminderPolicyFormInput } from "./admin-form-inputs";
export {
  toAdminProjectInput,
  toAdminUserInput,
  toReminderPolicyInput,
  toReportingGroupInput,
} from "./admin-form-inputs";
export type { MappedAdminSnapshot, MockSettings } from "./admin-types";

// ---- Helpers ----

function emptyStageGrid(): StageAssignment[] {
  return STAGE_NAMES.map((stage) => ({ stage, assigneeId: null }));
}

// "YYYY-MM-DD" — length of an ISO date-only prefix.
const ISO_DATE_LENGTH = 10;

function toIsoDateString(date: Date): string {
  // YYYY-MM-DD
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

function mapUser(api: AdminUser): MockUser {
  return {
    id: api.id,
    name: api.name,
    lastName: api.lastName,
    firstName: api.firstName,
    middleName: api.middleName,
    position: api.position,
    email: api.email,
    role: api.role,
    groupId: api.reportingGroupId ?? "",
    department: api.reportingGroupName ?? "No owning group",
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
    // Stage assignments load separately via admin.listStageAssignments;
    // surface an empty 7-stage grid here.
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

/**
 * Translates `reminderPolicySchema` → presentation. Field-for-field; keeps
 * `validFrom` + `validUntil` as JS Dates so the editor's date inputs can
 * format them with one consistent helper.
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
 * The Reminder status → active mapping:
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
    // Policies are emitted by `admin.snapshot`
    // (default `[]` keeps older / in-memory test snapshots compatible).
    policies: api.policies.map(mapReminderPolicy),
  };
}

/**
 * Translates `admin.getSettings` API output into the SettingsTab presentation
 * shape. Field-for-field copy — `appSettingsSchema` and `MockSettings` stay
 * structurally identical (the legacy `departmentName` field was dropped on
 * both sides at the same time).
 */
export function mapAdminSettings(api: AppSettings): MockSettings {
  return {
    autoCreatePeriods: api.autoCreatePeriods,
    defaultDeadlineDays: api.defaultDeadlineDays,
    // Pass-through for the added settings fields. The wire schema fills
    // defaults so older API responses still parse cleanly.
    periodLengthDays: api.periodLengthDays,
    workingDays: api.workingDays,
    gracePeriodHours: api.gracePeriodHours,
    allowLateSubmissions: api.allowLateSubmissions,
    autoPublishAfterDeadline: api.autoPublishAfterDeadline,
    autoArchiveWeeksAfterPublish: api.autoArchiveWeeksAfterPublish,
    deadlineTime: api.deadlineTime,
    allowReopenAfterPublish: api.allowReopenAfterPublish,
    reopenWindowHours: api.reopenWindowHours,
    unifiedActivityView: api.unifiedActivityView,
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
};
