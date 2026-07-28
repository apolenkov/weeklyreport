import type {
  DbRole,
  PeriodStatus,
  ReminderAudience,
  ReminderPolicyKind,
} from "@customreport/shared";

export type { StageName } from "@customreport/shared";

export interface AdminUserView {
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

export interface AdminGroupView {
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

export interface AdminProductView {
  id: string;
  name: string;
  leadOwnerId: string;
  stages: StageAssignment[];
  status: "active" | "archived";
}

export type { PeriodStatus } from "@customreport/shared";

export interface AdminPeriodView {
  id: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  // ISO date, or null when the period's deadline was cleared.
  deadline: string | null;
  status: PeriodStatus;
}

export interface AdminReminderView {
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

// Wire shape 1:1; no name/description synthesis — editor shows every column.
export interface AdminReminderPolicyView {
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

// Admin-tunable fields on the Periods / Reminders / Notifications sub-tabs;
// must stay aligned with the wire `appSettingsSchema`.
export interface AdminSettingsView {
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
  groups: AdminGroupView[];
  users: AdminUserView[];
  products: AdminProductView[];
  periods: AdminPeriodView[];
  reminders: AdminReminderView[];
  /** Policies surfaced for the Reminders Tab editor. */
  policies: AdminReminderPolicyView[];
}
