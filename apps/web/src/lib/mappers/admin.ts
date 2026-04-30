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
 * - `adminUserSchema` has no `department` field. We default to `'CoreDev'`.
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

// ---- Form-state -> API-input mappers (Phase 22 / Plan 22-04) ----
//
// These helpers translate the mock-shaped form state stored in each admin tab
// into the Zod-validated input expected by the corresponding mutation. They
// live in the mapper module so they can be unit-tested in isolation and so
// any contract drift (e.g. schema field renames) collects in one place.

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
  // API round-trip fields preserved from `adminReminderRuleSchema`. Surfaced
  // on the mock so the Reminders tab can rebuild a valid `saveReminderRule`
  // input (e.g. when toggling status without re-entering kind/fireAt).
  kind: 'deadline' | 'follow_up' | 'escalation';
  fireAt: Date;
  timezone: string;
  version: number;
  reportId: string | null;
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
    department: 'CoreDev',
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
  switch (kind) {
    case 'deadline':
      return 'Deadline reminder';
    case 'escalation':
      return 'Escalation digest';
    case 'follow_up':
    default:
      return 'Follow-up reminder';
  }
}

function reminderDescription(rule: AdminReminderRule): string {
  const at = rule.fireAt.toISOString().replace('T', ' ').slice(0, 16);
  switch (rule.kind) {
    case 'deadline':
      return `Send a reminder when the deadline is reached (fires at ${at} UTC).`;
    case 'escalation':
      return `Send a T+2h escalation digest to the head with all late leads (fires at ${at} UTC).`;
    case 'follow_up':
    default:
      return `Send a follow-up reminder to leads who have not submitted (fires at ${at} UTC).`;
  }
}

function mapReminder(api: AdminReminderRule): MockReminder {
  return {
    id: api.id,
    name: reminderName(api.kind),
    description: reminderDescription(api),
    active: api.status === 'active',
    kind: api.kind,
    fireAt: api.fireAt,
    timezone: api.timezone,
    version: api.version,
    reportId: api.reportId,
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

// ---- Form-state -> API-input helpers ----

/**
 * Generates a v4 UUID. The browser's `crypto.randomUUID` is required by every
 * env that runs this code (Next.js 16 + Node 20+). The fallback throws because
 * Zod will reject a non-UUID id at the API boundary.
 */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  throw new Error('crypto.randomUUID is required to generate ids for admin mutations');
}

export type AdminUserFormInput = {
  name: string;
  email: string;
  role: UserRole;
  // department is currently presentation-only (no API field) — accepted but ignored.
  department?: string;
};

/**
 * Maps the Users tab form state to the `adminUserSchema` payload. When editing
 * an existing user, pass `existingId`; when adding a new user, omit it and a
 * fresh UUID is generated client-side (the server will accept the inserted id
 * as-is per the schema's `id: uuid()`).
 */
export function toAdminUserInput(
  form: AdminUserFormInput,
  existingId?: string,
): { id: string; email: string; name: string; role: UserRole } {
  return {
    id: existingId ?? newId(),
    email: form.email.trim(),
    name: form.name.trim(),
    role: form.role,
  };
}

export type AdminProjectFormInput = {
  name: string;
  leadOwnerId: string;
  leadName?: string;
  archived?: boolean;
};

/**
 * Maps the Products tab form state to the `adminProjectSchema` payload.
 * `leadName` is required by the schema; if the form does not carry it, callers
 * resolve it from the users list before invoking this helper.
 */
export function toAdminProjectInput(
  form: AdminProjectFormInput,
  existingId?: string,
): { id: string; name: string; archived: boolean; leadId: string; leadName: string } {
  return {
    id: existingId ?? newId(),
    name: form.name.trim(),
    archived: form.archived ?? false,
    leadId: form.leadOwnerId,
    leadName: (form.leadName ?? '').trim() || 'Unknown Lead',
  };
}

export type ReportPeriodFormInput = {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  deadline: string;
  status?: 'draft' | 'published';
};

/**
 * Maps the Periods tab form state to the `reportPeriodSchema` payload.
 * Date strings are coerced via `new Date(...)`; the schema then re-validates
 * them with `reportDate()` (year >= 2000).
 */
export function toReportPeriodInput(
  form: ReportPeriodFormInput,
  existingId?: string,
): {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  status: 'draft' | 'published';
} {
  return {
    id: existingId ?? newId(),
    periodStart: new Date(form.startDate),
    periodEnd: new Date(form.endDate),
    deadline: new Date(form.deadline),
    status: form.status ?? 'draft',
  };
}

export type AdminReminderRuleFormInput = {
  kind: 'deadline' | 'follow_up' | 'escalation';
  fireAt: Date | string;
  timezone?: string;
  status?: 'active' | 'paused';
  reportId?: string | null;
  version?: number;
};

/**
 * Maps the Reminders tab form state to the `adminReminderRuleSchema` payload.
 */
export function toAdminReminderRuleInput(
  form: AdminReminderRuleFormInput,
  existingId?: string,
): {
  id: string;
  reportId: string | null;
  kind: 'deadline' | 'follow_up' | 'escalation';
  fireAt: Date;
  timezone: string;
  status: 'active' | 'paused';
  version: number;
} {
  const fireAt = form.fireAt instanceof Date ? form.fireAt : new Date(form.fireAt);
  return {
    id: existingId ?? newId(),
    reportId: form.reportId ?? null,
    kind: form.kind,
    fireAt,
    timezone: form.timezone ?? 'UTC',
    status: form.status ?? 'active',
    version: form.version ?? 1,
  };
}

// Internal exports for tests — keep narrow.
export const __testing = { mapReminder, mapPeriod, mapProject, mapUser, isoWeekLabel };
