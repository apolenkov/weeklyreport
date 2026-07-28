// Maps admin wire models to tab-owned presentation models. Snapshot products
// get an empty stage grid because assignments load separately; draft periods
// map to the UI's open status.

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

import { formatPeriodLabel, toIsoDateString } from "../../../lib/format-date";
import { mapReminder } from "./admin-reminder-mapper";
import type {
  AdminGroupView,
  AdminPeriodView,
  AdminProductView,
  AdminReminderPolicyView,
  AdminSettingsView,
  AdminUserView,
  MappedAdminSnapshot,
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
export type { AdminSettingsView, MappedAdminSnapshot } from "./admin-types";

// ---- Helpers ----

function emptyStageGrid(): StageAssignment[] {
  return STAGE_NAMES.map((stage) => ({ stage, assigneeId: null }));
}

function mapUser(api: AdminUser): AdminUserView {
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

function mapGroup(api: ReportingGroup): AdminGroupView {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? null,
    archived: api.archived,
    headUserId: api.headUserId ?? null,
  };
}

function mapProject(api: AdminProject): AdminProductView {
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

function mapPeriod(api: ReportPeriod): AdminPeriodView {
  // adminSnapshotSchema ships reportPeriodSchema (status: 'draft' | 'published').
  // Admin UI expects 'open' | 'published' | 'reopened'. Map 'draft' -> 'open';
  // 'reopened' is unreachable from this endpoint (only periodReadModelSchema
  // exposes periodStatus).
  const status: PeriodStatus =
    api.status === "published" ? "published" : "open";
  return {
    id: api.id,
    weekLabel: formatPeriodLabel(api.periodStart, api.periodEnd),
    startDate: toIsoDateString(api.periodStart),
    endDate: toIsoDateString(api.periodEnd),
    deadline: api.deadline === null ? null : toIsoDateString(api.deadline),
    status,
  };
}

// Keep validity bounds as Dates so every editor input uses one formatter.
function mapReminderPolicy(api: ReminderPolicy): AdminReminderPolicyView {
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

// Reminder status collapses to the tab's active boolean.
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

// Wire and presentation settings are intentionally field-for-field.
export function mapAdminSettings(api: AppSettings): AdminSettingsView {
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
};
