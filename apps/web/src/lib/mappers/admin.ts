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
  AdminSnapshot,
  AdminUser,
  AdminProject,
  ReportPeriod,
  AdminReminderRule,
  AppSettings,
  ReportingGroup,
  ReminderPolicy,
  ReminderPolicyKind,
  ReminderAudience,
} from "@customreport/shared";

import { formatPeriodLabel } from "../format-date";

// ---- Form-state -> API-input mappers (Phase 22 / Plan 22-04) ----
//
// These helpers translate the mock-shaped form state stored in each admin tab
// into the Zod-validated input expected by the corresponding mutation. They
// live in the mapper module so they can be unit-tested in isolation and so
// any contract drift (e.g. schema field renames) collects in one place.

// ---- Self-contained re-declarations of presentation types ----

export type UserRole = "lead" | "head" | "admin" | "viewer";

export type MockUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  groupId: string;
  department: string;
  // A2 (UAT-v7 2026-05-12): soft-deactivation flag from the API.
  isActive: boolean;
};

export type MockGroup = {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  headUserId: string | null;
};

export type StageName =
  | "Planning"
  | "Analysis"
  | "Design"
  | "Development"
  | "Testing"
  | "DevOps"
  | "Support";

const STAGE_NAMES: readonly StageName[] = [
  "Planning",
  "Analysis",
  "Design",
  "Development",
  "Testing",
  "DevOps",
  "Support",
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
  status: "active" | "archived";
};

export type PeriodStatus = "open" | "published" | "reopened";

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
  kind: "deadline" | "follow_up" | "escalation";
  fireAt: Date;
  timezone: string;
  version: number;
  reportId: string | null;
  // UFB-036 (Phase 44-04): policy FK preserved so the Reminders Tab can
  // group derived rules under their owning policy in the read-only
  // expander. `null` for legacy rules (created before 44-01).
  policyId: string | null;
};

/**
 * UFB-036 (Phase 44-04): presentation shape of {@link reminderPolicySchema}
 * for the Reminders Tab policy editor. Mirrors the wire schema 1:1 except
 * the wire-only `id` is preserved verbatim — there is no name/description
 * synthesis here because the editor surfaces every column directly.
 */
export type MockReminderPolicy = {
  id: string;
  kind: ReminderPolicyKind;
  offsetMinutes: number;
  timezone: string;
  audience: ReminderAudience;
  active: boolean;
  validFrom: Date;
  /** `null` means "forever" (no upper bound). */
  validUntil: Date | null;
};

// UFB-048 (Phase 48-B): MockSettings expanded with 9 new admin-tunable fields
// surfaced on the Periods / Reminders / Notifications sub-tabs. Field order
// mirrors the tab layout for readability. The mapper below copies through 1:1
// from the wire schema (`appSettingsSchema`).
// UFB-047 / Phase 49-01: legacy `departmentName` removed alongside the
// AppSettings column.
export type MockSettings = {
  autoCreatePeriods: boolean;
  defaultDeadlineDays: number;
  // Periods tab
  periodLengthDays: number;
  workingDays: "mon-fri" | "mon-sat" | "mon-sun";
  gracePeriodHours: number;
  allowLateSubmissions: boolean;
  autoPublishAfterDeadline: boolean;
  autoArchiveWeeksAfterPublish: number;
  // UFB-051 (Phase 51-A) — period-cycle knobs surfaced on the Periods tab.
  firstDayOfWeek: number; // 1=Monday..7=Sunday (ISO)
  deadlineDayOfWeek: number; // 1=Monday..7=Sunday (ISO)
  deadlineTime: string; // HH:MM (24h)
  maxOpenPeriods: number;
  requireAllSectionsToPublish: boolean;
  allowReopenAfterPublish: boolean;
  reopenWindowHours: number;
  // Reminders tab
  defaultTimezone: string;
  defaultReminderAudience: "lead-with-draft" | "head-of-late";
  // Notifications tab
  notificationFromEmail: string | null;
};

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
    isActive: api.isActive ?? true,
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

export type MappedAdminSnapshot = {
  groups: MockGroup[];
  users: MockUser[];
  products: MockProduct[];
  periods: MockPeriod[];
  reminders: MockReminder[];
  /** UFB-036 (Phase 44-04): policies surfaced for the Reminders Tab editor. */
  policies: MockReminderPolicy[];
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

// ---- Form-state -> API-input helpers ----

/**
 * Generates a v4 UUID. The browser's `crypto.randomUUID` is required by every
 * env that runs this code (Next.js 16 + Node 20+). The fallback throws because
 * Zod will reject a non-UUID id at the API boundary.
 */
function newId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  throw new Error(
    "crypto.randomUUID is required to generate ids for admin mutations",
  );
}

export type AdminUserFormInput = {
  name: string;
  email: string;
  role: UserRole;
  groupId: string;
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
): {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  reportingGroupId: string | null;
} {
  return {
    id: existingId ?? newId(),
    email: form.email.trim(),
    name: form.name.trim(),
    role: form.role,
    reportingGroupId: form.groupId || null,
  };
}

export type ReportingGroupFormInput = {
  name: string;
  description?: string | null;
  archived?: boolean;
  headUserId?: string | null;
};

export function toReportingGroupInput(
  form: ReportingGroupFormInput,
  existingId?: string,
): {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  headUserId: string | null;
} {
  return {
    id: existingId ?? newId(),
    name: form.name.trim(),
    description: form.description?.trim() ? form.description.trim() : null,
    archived: form.archived ?? false,
    headUserId: form.headUserId ?? null,
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
): {
  id: string;
  name: string;
  archived: boolean;
  leadId: string;
  leadName: string;
} {
  return {
    id: existingId ?? newId(),
    name: form.name.trim(),
    archived: form.archived ?? false,
    leadId: form.leadOwnerId,
    leadName: (form.leadName ?? "").trim() || "Unknown Lead",
  };
}

export type ReportPeriodFormInput = {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  deadline: string;
  status?: "draft" | "published";
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
  status: "draft" | "published";
} {
  return {
    id: existingId ?? newId(),
    periodStart: new Date(form.startDate),
    periodEnd: new Date(form.endDate),
    deadline: new Date(form.deadline),
    status: form.status ?? "draft",
  };
}

export type AdminReminderRuleFormInput = {
  kind: "deadline" | "follow_up" | "escalation";
  fireAt: Date | string;
  timezone?: string;
  status?: "active" | "paused";
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
  kind: "deadline" | "follow_up" | "escalation";
  fireAt: Date;
  timezone: string;
  status: "active" | "paused";
  version: number;
} {
  const fireAt =
    form.fireAt instanceof Date ? form.fireAt : new Date(form.fireAt);
  return {
    id: existingId ?? newId(),
    reportId: form.reportId ?? null,
    kind: form.kind,
    fireAt,
    timezone: form.timezone ?? "UTC",
    status: form.status ?? "active",
    version: form.version ?? 1,
  };
}

/**
 * UFB-036 (Phase 44-04): Reminders Tab policy editor form-state.
 *
 * The form binds:
 *   - `kind`, `offsetMinutes`, `timezone`, `audience`, `active`: 1:1 with
 *     `reminderPolicySchema`.
 *   - `validFromIso`: `YYYY-MM-DD` from a `<input type="date">`. Always
 *     present; defaults to today on the "Add" form.
 *   - `validUntilIso`: `YYYY-MM-DD` or `null`. `null` means the user has
 *     ticked the "forever" checkbox so the upper bound is open.
 */
export type AdminReminderPolicyFormInput = {
  kind: ReminderPolicyKind;
  offsetMinutes: number;
  timezone: string;
  audience: ReminderAudience;
  active: boolean;
  validFromIso: string;
  validUntilIso: string | null;
};

/**
 * Maps the policy form state to the `reminderPolicySchema` payload.
 *
 * The "forever" checkbox flips `validUntilIso` to `null` which becomes
 * `validUntil: null` on the wire. Otherwise the YYYY-MM-DD string is
 * coerced into a JS Date at midnight UTC (matching how the prisma column
 * stores `DateTime`); the schema's `z.coerce.date()` accepts either form
 * but emitting a Date here means the network payload after JSON.stringify
 * is a clean ISO timestamp.
 */
export function toReminderPolicyInput(
  form: AdminReminderPolicyFormInput,
  existingId?: string,
): {
  id: string;
  kind: ReminderPolicyKind;
  offsetMinutes: number;
  timezone: string;
  audience: ReminderAudience;
  active: boolean;
  validFrom: Date;
  validUntil: Date | null;
} {
  return {
    id: existingId ?? newId(),
    kind: form.kind,
    offsetMinutes: form.offsetMinutes,
    timezone: form.timezone,
    audience: form.audience,
    active: form.active,
    validFrom: new Date(`${form.validFromIso}T00:00:00.000Z`),
    validUntil:
      form.validUntilIso === null
        ? null
        : new Date(`${form.validUntilIso}T00:00:00.000Z`),
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
