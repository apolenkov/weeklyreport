import type {
  PeriodState,
  ReminderPolicyKind,
  Role,
} from "@customreport/shared";

/**
 * Structured audit envelope for security-relevant events.
 *
 * Every audit line carries the same fixed shape so log-aggregation queries
 * can filter on `event` without parsing the message. The wrapper composes
 * onto the existing AppLogger (nestjs-cls correlation IDs); there
 * is no new transport, no new file rotation, no new env var.
 *
 * Threat-model notes:
 *  - T1: the emitters hand-enumerate every field they copy from the typed
 *    input and never spread a raw request, so a SAML assertion / cookie /
 *    token has no path into the envelope. (Types alone would not block a
 *    spread with extra keys — the enumeration is the actual guarantee.)
 *  - T2: silent role escalation is prevented by always emitting role-denied
 *    even when role/userId are missing — anonymous events use
 *    `userId: 'anonymous'` and `role: null`, never a non-enum literal like
 *    'unknown', which would break SIEM rules tuned to the Role enum.
 *  - T3: ip is captured upstream from `req.ip` (Express trust-proxy aware),
 *    never from raw X-Forwarded-For; this module is a pure consumer.
 */
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

/**
 * Emitted when a head/viewer (anyone non-admin)
 * requests a specific resource id that falls outside their group scope.
 * Mirrors `role-denied` shape but adds a free-form `attemptedScope`
 * description (e.g. "reportSection", "report") and the offending
 * `resourceId` so SIEM rules can detect probing patterns.
 */
type ScopeDeniedInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly attemptedScope: string;
  readonly resourceId: string;
};

/**
 * Mutation audit envelope.
 *
 * Captured for every authenticated tRPC mutation (excluding `auth.*` —
 * already covered by loginSuccess/loginFail — and `ai.*` — privacy: AI
 * prompts/responses must never reach the audit stream).
 *
 * `target` is a best-effort extraction from the procedure input —
 * whichever of id / reportId / sectionId / periodId / projectId / leadId
 * the input carries. Absent on signature-less mutations like
 * `period.publish` where the period is implied by session.
 *
 * `status` distinguishes success from any thrown TRPCError (validation,
 * authz, internal). For failures, `reason` carries the error message.
 */
type MutationInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly procedure: string;
  readonly target?: string;
  readonly status: "success" | "fail";
  readonly duration: number;
  readonly reason?: string;
};

/**
 * Emitted whenever an admin upserts or removes
 * a {@link ReminderPolicy}. The generic `mutation` envelope already
 * captures these as `procedure='admin.savePolicy' | 'admin.removePolicy'`,
 * but a dedicated event lets SIEM rules filter on `event` directly
 * (mirrors the `scope-denied` precedent) and carries the
 * policy `kind` + create/update `action` so dashboards can split create
 * vs update without parsing the procedure string.
 */
type PolicySaveInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly policyId: string;
  readonly kind: ReminderPolicyKind;
  readonly action: "create" | "update";
};

type PolicyRemoveInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly policyId: string;
};

/**
 * Emitted on every successful admin update of the
 * `Organization` singleton (shortName/fullName change). Carries the
 * before/after values so SIEM rules and dashboards can audit brand
 * tampering — relevant because the same row drives the landing hero,
 * nav-bar, and PDF/email headers.
 */
type OrganizationUpdateInput = Omit<
  AuditEnvelope,
  "event" | "attemptedRole"
> & {
  readonly previousShortName: string;
  readonly previousFullName: string;
  readonly nextShortName: string;
  readonly nextFullName: string;
};

/**
 * Emitted by the period-lifecycle scheduler classes
 * (`PeriodCreatorScheduler`, `AutoPublisherScheduler`, `AutoArchiverScheduler`).
 *
 * No human actor — `userId='system'` and `role=null`. `ip` is omitted from the
 * envelope (cron has no inbound request); we still set it to the literal
 * 'cron' so the wire shape is uniform across audit consumers and SIEM rules
 * keyed on `ip` do not have to special-case missing fields.
 *
 * `periodAutoCreate` — fired once per newly-created Period; carries the
 * computed periodStart/end/deadline so dashboards can sanity-check the
 * scheduler's date math without joining back to Report.
 *
 * `periodAutoPublish` — fired per auto-published Report; carries
 * `missingSectionsCount` so on-call can quickly tell how many leads got
 * stamped "Не сдал" by the auto-publish step.
 *
 * `periodAutoArchive` — fired per Report flipped to archived=true; carries
 * just the periodId for traceability.
 */
interface PeriodAutoCreateInput {
  readonly periodId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly deadline: string;
  /**
   * State-transition payload. For a fresh create,
   * `from` is null (no prior state) and `to` is either 'scheduled' (future
   * period) or 'open' (period that has already started by the time the
   * tick runs). Mirrors the publish/archive envelopes so SIEM rules and
   * dashboards can filter on `(from, to)` uniformly across the three
   * scheduler events.
   */
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

/**
 * Emitted when an admin manually mints a Period via
 * `admin.createPeriodManual`. Unlike `period.auto-create` (system actor,
 * ip='cron'), this event carries a human actor — `userId` / `role` / `ip`
 * are real, taken from the tRPC session. Mirrors the auto-create payload
 * (`from=null`, `to=<initial state>`) so SIEM rules that filter on
 * `(from, to)` work uniformly across both creation paths.
 */
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

/**
 * Emitted when a non-admin weekly-report read legitimately surfaces at
 * least one product from another group through the explicit `GroupProduct`
 * join (closes the audit-trail asymmetry with `scope-denied`).
 *
 * Payload is whitelisted at the type level — only typed ids flow,
 * never row contents (same threat-model discipline as `scopeDenied`).
 * Emitted at `info` (granted access is normal traffic; `scopeDenied` stays
 * at `warn`). Per-request dedupe: one event per read regardless of how
 * many cross-group products surface.
 */
type ScopeAccessedInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly accessedScope: string;
  readonly productIds: readonly string[];
  readonly groupIds: readonly string[];
  readonly resourceId: string;
};

/**
 * Emitted when an admin edits an existing period's envelope via
 * `admin.updatePeriodManual`. The `changes` payload carries only the
 * changed fields' before/after as ISO strings (dates) or string|null
 * (weekLabel) — same shape the service's diff returns. SIEM filters that
 * audit "what dates moved" key on `changes.<field>` presence; no-op edits
 * never reach this event (the router skips emission when diff is empty).
 */
type PeriodManualEditInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
  readonly periodId: string;
  readonly changes: Partial<{
    periodStart: { from: string; to: string };
    periodEnd: { from: string; to: string };
    deadline: { from: string; to: string };
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
