/**
 * Translates `admin.snapshot` + `admin.getSettings` to the mock-shaped types
 * the existing admin tab components expect.
 *
 * Per CONTEXT.md migration order, used by Users, Products, Periods, Reminders,
 * and Settings tabs. The mapper is intentionally self-contained and re-declares
 * the presentation types so downstream consumers do not couple to a particular
 * UI module (`apps/web/src/components/admin/mock-data.ts`).
 *
 * Synthesis notes (Phase 21 / Plan 21-03):
 * - `adminSnapshotSchema` does NOT carry stages or stageAssignments. We default
 *   each product to 7 empty stage rows (assigneeId: null) so ProductsTab still
 *   renders. Phase 22 wires real stage assignments via `admin.listStageAssignments`.
 * - `adminUserSchema` has no `department` field. We default to `'Development'`.
 * - `adminProjectSchema.archived: boolean` collapses to mock `status: 'active'|'archived'`.
 * - `reportPeriodSchema.status` is `'draft'|'published'`. We map `'draft' -> 'open'`
 *   (the schema lacks a `'reopened'` enum at this read endpoint — `periodReadModelSchema`
 *   has `periodStatus` but `admin.snapshot` returns `reportPeriodSchema`).
 * - `weekLabel` is synthesized from `periodStart` (ISO week number).
 * - `adminReminderRuleSchema` has no name/description. We synthesize from `kind`
 *   and `fireAt`.
 * - `appSettingsSchema` is a 1:1 match for `MockSettings` (departmentName,
 *   autoCreatePeriods, defaultDeadlineDays).
 */

import type {
  AdminSnapshot,
  AdminUser,
  AdminProject,
  ReportPeriod,
  AdminReminderRule,
  AppSettings,
} from '@customreport/shared';

// ---- Self-contained re-declarations of presentation types ----

export type UserRole = 'lead' | 'head' | 'viewer';

export type MockUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
};

export type StageName =
  | 'Planning'
  | 'Analysis'
  | 'Design'
  | 'Development'
  | 'Testing'
  | 'DevOps'
  | 'Support';

const STAGE_NAMES: readonly StageName[] = [
  'Planning',
  'Analysis',
  'Design',
  'Development',
  'Testing',
  'DevOps',
  'Support',
];

export type StageAssignment = {
  stage: StageName;
  assigneeId: string | null;
};

export type MockProduct = {
  id: string;
  name: string;
  leadOwnerId: string;
  stages: StageAssignment[];
  status: 'active' | 'archived';
};

export type PeriodStatus = 'open' | 'published' | 'reopened';

export type MockPeriod = {
  id: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  deadline: string;
  status: PeriodStatus;
};

export type MockReminder = {
  id: string;
  name: string;
  description: string;
  active: boolean;
};

export type MockSettings = {
  departmentName: string;
  autoCreatePeriods: boolean;
  defaultDeadlineDays: number;
};

// ---- Helpers ----

function emptyStageGrid(): StageAssignment[] {
  return STAGE_NAMES.map((stage) => ({ stage, assigneeId: null }));
}

/** Returns ISO week label like "Week 17" given a Date in the UTC range. */
function isoWeekLabel(date: Date): string {
  // ISO week number per ISO-8601: thursday-anchored.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
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
    // API has no department field; default to canonical org unit.
    department: 'Development',
  };
}

function mapProject(api: AdminProject): MockProduct {
  return {
    id: api.id,
    name: api.name,
    leadOwnerId: api.leadId,
    status: api.archived ? 'archived' : 'active',
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
  const status: PeriodStatus = api.status === 'published' ? 'published' : 'open';
  return {
    id: api.id,
    weekLabel: isoWeekLabel(api.periodStart),
    startDate: toIsoDateString(api.periodStart),
    endDate: toIsoDateString(api.periodEnd),
    deadline: toIsoDateString(api.deadline),
    status,
  };
}

function reminderName(kind: AdminReminderRule['kind']): string {
  return kind === 'deadline' ? 'Deadline reminder' : 'Follow-up reminder';
}

function reminderDescription(rule: AdminReminderRule): string {
  const at = rule.fireAt.toISOString().replace('T', ' ').slice(0, 16);
  return rule.kind === 'deadline'
    ? `Send a reminder when the deadline is reached (fires at ${at} UTC).`
    : `Send a follow-up reminder to leads who have not submitted (fires at ${at} UTC).`;
}

function mapReminder(api: AdminReminderRule): MockReminder {
  return {
    id: api.id,
    name: reminderName(api.kind),
    description: reminderDescription(api),
    active: api.status === 'active',
  };
}

// ---- Public mappers ----

export type MappedAdminSnapshot = {
  users: MockUser[];
  products: MockProduct[];
  periods: MockPeriod[];
  reminders: MockReminder[];
};

/**
 * Translates `admin.snapshot` API output into the slices each admin tab needs.
 *
 * The Reminder enum mapping follows PITFALLS Pitfall 1:
 *   apiStatus === 'active' => mock.active === true
 *   apiStatus === 'paused' => mock.active === false
 */
export function mapAdminSnapshot(api: AdminSnapshot): MappedAdminSnapshot {
  return {
    users: api.users.map(mapUser),
    products: api.projects.map(mapProject),
    periods: api.periods.map(mapPeriod),
    reminders: api.reminderRules.map(mapReminder),
  };
}

/**
 * Translates `admin.getSettings` API output into the SettingsTab presentation
 * shape. Field-for-field copy — `appSettingsSchema` and `MockSettings` are
 * structurally identical at v5.0.
 */
export function mapAdminSettings(api: AppSettings): MockSettings {
  return {
    departmentName: api.departmentName,
    autoCreatePeriods: api.autoCreatePeriods,
    defaultDeadlineDays: api.defaultDeadlineDays,
  };
}

// Internal exports for tests — keep narrow.
export const __testing = { mapReminder, mapPeriod, mapProject, mapUser, isoWeekLabel };
