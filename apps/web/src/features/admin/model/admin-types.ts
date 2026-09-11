import type {
  AdminSnapshot,
  DbRole,
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
  groupId: string | null;
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

export interface AdminReminderView {
  policyId: string;
  fireAt: Date;
  active: boolean;
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
  // null means "forever" (no upper bound).
  validUntil: Date | null;
}

/** Read-only delivery facts shown alongside reminder policies. */
export type AdminReminderExecutionView = Pick<
  AdminSnapshot["reminderExecutions"][number],
  | "id"
  | "ruleId"
  | "reportId"
  | "status"
  | "scheduledFor"
  | "sentAt"
  | "recipientEmail"
  | "errorMessage"
>;

export interface MappedAdminSnapshot {
  groups: AdminGroupView[];
  users: AdminUserView[];
  products: AdminProductView[];
  reminders: AdminReminderView[];
  policies: AdminReminderPolicyView[];
  executions: AdminReminderExecutionView[];
}
