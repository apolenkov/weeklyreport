import type {
  PeriodState,
  ReminderPolicyKind,
  Role,
} from "@customreport/shared";

// Fixed envelopes keep SIEM queries structural. Emitters enumerate fields
// instead of spreading requests, and IPs arrive from trust-proxy-aware req.ip,
// so credentials and raw forwarding headers have no path into audit records.
export type AuditEvent =
  | "login-success"
  | "login-fail"
  | "logout"
  | "role-denied"
  | "scope-denied"
  | "mutation"
  | "admin.policy.save"
  | "admin.policy.remove"
  | "admin.organization.update"
  | "period.auto-create"
  | "period.auto-publish"
  | "period.auto-archive"
  | "period.manual-create"
  | "period.manual-edit"
  | "scope-accessed";

interface AuditEnvelope {
  readonly event: AuditEvent;
  readonly userId: string;
  readonly role: Role | null;
  readonly attemptedRole?: readonly Role[] | Role;
  readonly ip: string;
}

type LoginSuccessInput = Omit<AuditEnvelope, "event" | "attemptedRole">;
type LoginFailInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly reason: string;
};
type LogoutInput = Omit<AuditEnvelope, "event" | "attemptedRole">;
type RoleDeniedInput = Omit<AuditEnvelope, "event">;

// Adds scope and resource identity to denied access so probing patterns remain
// distinguishable from ordinary role denials.
type ScopeDeniedInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly attemptedScope: string;
  readonly resourceId: string;
};

// Auth has dedicated events and ai.* is privacy-excluded. Target is
// best-effort because some mutations derive identity from the session;
// failures retain the thrown reason for operational diagnosis.
type MutationInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly procedure: string;
  readonly target?: string;
  readonly status: "success" | "fail";
  readonly duration: number;
  readonly reason?: string;
};

// Dedicated policy events expose kind/action directly instead of making SIEM
// dashboards parse generic mutation procedure names.
type PolicySaveInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly policyId: string;
  readonly kind: ReminderPolicyKind;
  readonly action: "create" | "update";
};

type PolicyRemoveInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly policyId: string;
};

// Organization branding reaches the landing page, navigation, PDFs, and email;
// before/after values make successful admin changes auditable.
type OrganizationUpdateInput = Omit<
  AuditEnvelope,
  "event" | "attemptedRole"
> & {
  readonly previousShortName: string;
  readonly previousFullName: string;
  readonly nextShortName: string;
  readonly nextFullName: string;
};

// Scheduler events use the uniform actor `{userId:"system", role:null,
// ip:"cron"}`. Create carries computed dates, publish the missing-section
// impact, and archive the period identity.
interface PeriodAutoCreateInput {
  readonly periodId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly deadline: string;
  // A fresh create has no prior state; the shared from/to shape keeps scheduler
  // transition queries uniform.
  readonly from: PeriodState | null;
  readonly to: PeriodState;
}

interface PeriodAutoPublishInput {
  readonly periodId: string;
  readonly missingSectionsCount: number;
  /** State transition (typically open → published). */
  readonly from: PeriodState;
  readonly to: PeriodState;
}

interface PeriodAutoArchiveInput {
  readonly periodId: string;
  /** State transition (typically published → archived). */
  readonly from: PeriodState;
  readonly to: PeriodState;
}

// Manual creation keeps the auto-create transition shape but carries the real
// session actor, allowing one from/to query across both paths.
type PeriodManualCreateInput = Omit<
  AuditEnvelope,
  "event" | "attemptedRole"
> & {
  readonly periodId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly deadline: string;
  readonly from: PeriodState | null;
  readonly to: PeriodState;
};

// Granted cross-group reads emit one info event per request. Only identifiers
// are allowed in the payload, preserving the same data boundary as denials.
type ScopeAccessedInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly accessedScope: string;
  readonly productIds: readonly string[];
  readonly groupIds: readonly string[];
  readonly resourceId: string;
};

// Only changed period fields reach the audit event; no-op edits emit nothing.
// Dates are ISO strings so SIEM rules can key directly on field presence.
type PeriodManualEditInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly periodId: string;
  readonly changes: Partial<{
    periodStart: { from: string; to: string };
    periodEnd: { from: string; to: string };
    // Three-state deadline (ruling F16): `to: null` = explicit clear,
    // `from: null` = a deadline was set on a previously deadline-less period.
    deadline: { from: string | null; to: string | null };
    weekLabel: { from: string | null; to: string | null };
  }>;
};

export interface AuditLogger {
  loginSuccess(input: LoginSuccessInput): void;
  loginFail(input: LoginFailInput): void;
  logout(input: LogoutInput): void;
  roleDenied(input: RoleDeniedInput): void;
  scopeDenied(input: ScopeDeniedInput): void;
  mutation(input: MutationInput): void;
  policySave(input: PolicySaveInput): void;
  policyRemove(input: PolicyRemoveInput): void;
  organizationUpdate(input: OrganizationUpdateInput): void;
  periodAutoCreate(input: PeriodAutoCreateInput): void;
  periodAutoPublish(input: PeriodAutoPublishInput): void;
  periodAutoArchive(input: PeriodAutoArchiveInput): void;
  periodManualCreate(input: PeriodManualCreateInput): void;
  periodManualEdit(input: PeriodManualEditInput): void;
  scopeAccessed(input: ScopeAccessedInput): void;
}
