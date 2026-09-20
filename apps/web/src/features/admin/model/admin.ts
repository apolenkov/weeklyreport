// Maps admin wire models to tab-owned presentation models. Snapshot products
// get an empty stage grid because assignments load separately.

import type {
  AdminProject,
  AdminSnapshot,
  AdminUser,
  ReminderPolicy,
  ReportingGroup,
} from "@customreport/shared";
import { STAGE_NAMES } from "@customreport/shared";

import { mapReminder } from "./admin-reminder-mapper";
import type {
  AdminGroupView,
  AdminProductView,
  AdminReminderExecutionView,
  AdminReminderPolicyView,
  AdminUserView,
  MappedAdminSnapshot,
  StageAssignment,
} from "./admin-types";

export type { AdminReminderPolicyFormInput } from "./admin-form-inputs";
export {
  toAdminProjectInput,
  toAdminUserInput,
  toReminderPolicyInput,
  toReportingGroupInput,
  UnresolvedProjectLeadError,
} from "./admin-form-inputs";
export type { MappedAdminSnapshot } from "./admin-types";

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
    groupId: api.reportingGroupId ?? null,
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

function mapReminderExecution(
  api: AdminSnapshot["reminderExecutions"][number],
): AdminReminderExecutionView {
  return {
    id: api.id,
    ruleId: api.ruleId,
    reportId: api.reportId,
    status: api.status,
    scheduledFor: api.scheduledFor,
    sentAt: api.sentAt,
    recipientEmail: api.recipientEmail,
    errorMessage: api.errorMessage,
  };
}

// ---- Public mappers ----

// Reminder status collapses to the tab's active boolean.
export function mapAdminSnapshot(api: AdminSnapshot): MappedAdminSnapshot {
  return {
    groups: api.groups.map(mapGroup),
    users: api.users.map(mapUser),
    products: api.projects.map(mapProject),
    reminders: api.reminderRules.map(mapReminder),
    // Policies are emitted by `admin.snapshot`.
    policies: api.policies.map(mapReminderPolicy),
    executions: api.reminderExecutions.map(mapReminderExecution),
  };
}
