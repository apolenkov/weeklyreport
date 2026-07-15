/**
 * Canonical presentation types for the admin tabs. The mapper logic that
 * produces them lives in `admin.ts`; the form-state-to-API helpers live in
 * `admin-form-inputs.ts`.
 */

import type {
  DbRole,
  ReminderAudience,
  ReminderPolicyKind,
} from "@customreport/shared";

export type { StageName } from "@customreport/shared";

export interface MockUser {
  id: string;
  // Stored display name, denormalized from the parts below.
  name: string;
  // Structured ФИО parts (surname-first). last/first required, patronymic
  // optional. The Users table renders the short form; the avatar uses initials.
  lastName: string;
  firstName: string;
  middleName: string | null;
  // Admin-maintained HR job title (должность), independent of `role`.
  position: string | null;
  email: string;
  role: DbRole;
  groupId: string;
  // Reporting-group display label (NOT an HR field — distinct from `position`).
  department: string;
  // Soft-deactivation flag from the API.
  isActive: boolean;
}

export interface MockGroup {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  headUserId: string | null;
}

export interface StageAssignment {
  stage: import("@customreport/shared").StageName;
  assigneeId: string | null;
}

export interface MockProduct {
  id: string;
  name: string;
  leadOwnerId: string;
  stages: StageAssignment[];
  status: "active" | "archived";
}

export type PeriodStatus = "open" | "published" | "reopened";

export interface MockPeriod {
  id: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  deadline: string;
  status: PeriodStatus;
}

export interface MockReminder {
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
  // Policy FK preserved so the Reminders Tab can group derived rules under
  // their owning policy in the read-only expander. `null` for legacy rules
  // created before policies existed.
  policyId: string | null;
}

/**
 * Presentation shape of {@link reminderPolicySchema} for the Reminders Tab
 * policy editor. Mirrors the wire schema 1:1 except the wire-only `id` is
 * preserved verbatim — there is no name/description synthesis here because
 * the editor surfaces every column directly.
 */
export interface MockReminderPolicy {
  id: string;
  kind: ReminderPolicyKind;
  offsetMinutes: number;
  timezone: string;
  audience: ReminderAudience;
  active: boolean;
  validFrom: Date;
  /** `null` means "forever" (no upper bound). */
  validUntil: Date | null;
}

// MockSettings surfaces the admin-tunable fields on the Periods / Reminders /
// Notifications sub-tabs. Field order mirrors the tab layout for readability.
// The mapper in `admin.ts` copies these through 1:1 from the wire schema
// (`appSettingsSchema`). The legacy `departmentName` field was removed
// alongside the AppSettings column.
export interface MockSettings {
  autoCreatePeriods: boolean;
  defaultDeadlineDays: number;
  // Periods tab
  periodLengthDays: number;
  workingDays: "mon-fri" | "mon-sat" | "mon-sun";
  gracePeriodHours: number;
  allowLateSubmissions: boolean;
  autoPublishAfterDeadline: boolean;
  autoArchiveWeeksAfterPublish: number;
  // Period-cycle knobs.
  deadlineTime: string; // HH:MM (24h)
  allowReopenAfterPublish: boolean;
  reopenWindowHours: number;
  // Opt-in unified by-state lead-form view (presentation projection).
  unifiedActivityView: boolean;
  // Reminders tab
  defaultTimezone: string;
  defaultReminderAudience: "lead-with-draft" | "head-of-late";
  // Notifications tab
  notificationFromEmail: string | null;
}

export interface MappedAdminSnapshot {
  groups: MockGroup[];
  users: MockUser[];
  products: MockProduct[];
  periods: MockPeriod[];
  reminders: MockReminder[];
  /** Policies surfaced for the Reminders Tab editor. */
  policies: MockReminderPolicy[];
}
