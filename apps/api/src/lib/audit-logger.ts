import type {
  PeriodState,
  ReminderPolicyKind,
  Role,
} from '@customreport/shared';

import type { AppLogger } from './logger.js';

/**
 * AUTH-08 — structured audit envelope for security-relevant events.
 *
 * Every audit line carries the same fixed shape so log-aggregation queries
 * can filter on `event` without parsing the message. The wrapper composes
 * onto the existing AppLogger (Phase 26 nestjs-cls correlation IDs); there
 * is no new transport, no new file rotation, no new env var.
 *
 * Threat-model notes:
 *  - T1: payload is whitelisted at type level — no SAML assertion / cookie /
 *    token can leak in (Omit<...> on the input types blocks extra keys at
 *    callsites; the implementation only spreads the typed input, never the
 *    raw request).
 *  - T2: silent role escalation is prevented by always emitting role-denied
 *    even when role/userId are missing — anonymous events use
 *    `userId: 'anonymous'` and `role: null` (Phase 32-M8 / M-08, replacing
 *    the previous 'unknown' literal which broke SIEM rules tuned to the
 *    Role enum).
 *  - T3: ip is captured upstream from `req.ip` (Express trust-proxy aware),
 *    never from raw X-Forwarded-For; this module is a pure consumer.
 */
export type AuditEvent =
  | 'login-success'
  | 'login-fail'
  | 'logout'
  | 'role-denied'
  | 'scope-denied'
  | 'mutation'
  | 'admin.policy.save'
  | 'admin.policy.remove'
  | 'admin.organization.update'
  | 'period.auto-create'
  | 'period.auto-publish'
  | 'period.auto-archive'
  | 'period.manual-create';

export type AuditEnvelope = {
  readonly event: AuditEvent;
  readonly userId: string;
  readonly role: Role | null;
  readonly attemptedRole?: ReadonlyArray<Role> | Role;
  readonly ip: string;
};

type LoginSuccessInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'>;
type LoginFailInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'> & {
  readonly reason: string;
};
type LogoutInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'>;
type RoleDeniedInput = Omit<AuditEnvelope, 'event'>;

/**
 * UFB-040 / Phase 46-05: emitted when a head/viewer (anyone non-admin)
 * requests a specific resource id that falls outside their group scope.
 * Mirrors `role-denied` shape but adds a free-form `attemptedScope`
 * description (e.g. "reportSection", "report") and the offending
 * `resourceId` so SIEM rules can detect probing patterns.
 */
type ScopeDeniedInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'> & {
  readonly attemptedScope: string;
  readonly resourceId: string;
};

/**
 * 36-02 mutation audit envelope.
 *
 * Captured for every authenticated tRPC mutation (excluding `auth.*` —
 * already covered by loginSuccess/loginFail — and `ai.*` — privacy: AI
 * prompts/responses must never reach the audit stream, see Phase 31
 * AI-SPEC §5.3 / PITFALLS C-3).
 *
 * `target` is a best-effort extraction from the procedure input (id,
 * reportId, sectionId, periodId, projectId, leadId — the common shapes
 * across the 26 mutations). Absent on signature-less mutations like
 * `period.publish` where the period is implied by session.
 *
 * `status` distinguishes success from any thrown TRPCError (validation,
 * authz, internal). For failures, `reason` carries the error message.
 */
type MutationInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'> & {
  readonly procedure: string;
  readonly target?: string;
  readonly status: 'success' | 'fail';
  readonly duration: number;
  readonly reason?: string;
};

/**
 * UFB-036 / Phase 44-05: emitted whenever an admin upserts or removes
 * a {@link ReminderPolicy}. The generic `mutation` envelope already
 * captures these as `procedure='admin.savePolicy' | 'admin.removePolicy'`,
 * but a dedicated event lets SIEM rules filter on `event` directly
 * (mirrors the `scope-denied` precedent from 46-05) and carries the
 * policy `kind` + create/update `action` so dashboards can split create
 * vs update without parsing the procedure string.
 */
type PolicySaveInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'> & {
  readonly policyId: string;
  readonly kind: ReminderPolicyKind;
  readonly action: 'create' | 'update';
};

type PolicyRemoveInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'> & {
  readonly policyId: string;
};

/**
 * UFB-047 / Phase 48-A: emitted on every successful admin update of the
 * `Organization` singleton (shortName/fullName change). Carries the
 * before/after values so SIEM rules and dashboards can audit brand
 * tampering — relevant because the same row drives the landing hero,
 * nav-bar, and PDF/email headers.
 */
type OrganizationUpdateInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'> & {
  readonly previousShortName: string;
  readonly previousFullName: string;
  readonly nextShortName: string;
  readonly nextFullName: string;
};

/**
 * UFB-049 / Phase 50-B: emitted by the period-lifecycle scheduler classes
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
type PeriodAutoCreateInput = {
  readonly periodId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly deadline: string;
  /**
   * UFB-053 / Phase 51-C: state-transition payload. For a fresh create,
   * `from` is null (no prior state) and `to` is either 'scheduled' (future
   * period) or 'open' (period that has already started by the time the
   * tick runs). Mirrors the publish/archive envelopes so SIEM rules and
   * dashboards can filter on `(from, to)` uniformly across the three
   * scheduler events.
   */
  readonly from: PeriodState | null;
  readonly to: PeriodState;
};

type PeriodAutoPublishInput = {
  readonly periodId: string;
  readonly missingSectionsCount: number;
  /** UFB-053 / Phase 51-C: state transition (typically open → published). */
  readonly from: PeriodState;
  readonly to: PeriodState;
};

type PeriodAutoArchiveInput = {
  readonly periodId: string;
  /** UFB-053 / Phase 51-C: state transition (typically published → archived). */
  readonly from: PeriodState;
  readonly to: PeriodState;
};

/**
 * UFB-063: emitted when an admin manually mints a Period via
 * `admin.createPeriodManual`. Unlike `period.auto-create` (system actor,
 * ip='cron'), this event carries a human actor — `userId` / `role` / `ip`
 * are real, taken from the tRPC session. Mirrors the auto-create payload
 * (`from=null`, `to=<initial state>`) so SIEM rules that filter on
 * `(from, to)` work uniformly across both creation paths.
 */
type PeriodManualCreateInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'> & {
  readonly periodId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly deadline: string;
  readonly from: PeriodState | null;
  readonly to: PeriodState;
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
}

const AUDIT_MESSAGE = 'audit';

/**
 * Build an AuditLogger that writes through the supplied AppLogger.
 *
 * Successes flow to `info`, denials and login failures flow to `warn` so the
 * default AppLogger configuration surfaces them at the operationally
 * appropriate level without any extra setup.
 */
export function createAuditLogger(logger: AppLogger): AuditLogger {
  return {
    loginSuccess(input) {
      logger.info(AUDIT_MESSAGE, {
        event: 'login-success',
        userId: input.userId,
        role: input.role,
        ip: input.ip,
      });
    },
    loginFail(input) {
      logger.warn(AUDIT_MESSAGE, {
        event: 'login-fail',
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        reason: input.reason,
      });
    },
    logout(input) {
      logger.info(AUDIT_MESSAGE, {
        event: 'logout',
        userId: input.userId,
        role: input.role,
        ip: input.ip,
      });
    },
    roleDenied(input) {
      logger.warn(AUDIT_MESSAGE, {
        event: 'role-denied',
        userId: input.userId,
        role: input.role,
        attemptedRole: input.attemptedRole,
        ip: input.ip,
      });
    },
    scopeDenied(input) {
      logger.warn(AUDIT_MESSAGE, {
        event: 'scope-denied',
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        attemptedScope: input.attemptedScope,
        resourceId: input.resourceId,
      });
    },
    mutation(input) {
      // Successes flow at info; failures flow at warn so the default logger
      // surface escalates appropriately without extra config.
      const level = input.status === 'success' ? 'info' : 'warn';
      logger[level](AUDIT_MESSAGE, {
        event: 'mutation',
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        procedure: input.procedure,
        target: input.target,
        status: input.status,
        duration: input.duration,
        ...(input.reason ? { reason: input.reason } : {}),
      });
    },
    policySave(input) {
      logger.info(AUDIT_MESSAGE, {
        event: 'admin.policy.save',
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        policyId: input.policyId,
        kind: input.kind,
        action: input.action,
      });
    },
    policyRemove(input) {
      logger.info(AUDIT_MESSAGE, {
        event: 'admin.policy.remove',
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        policyId: input.policyId,
      });
    },
    organizationUpdate(input) {
      logger.info(AUDIT_MESSAGE, {
        event: 'admin.organization.update',
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        previousShortName: input.previousShortName,
        previousFullName: input.previousFullName,
        nextShortName: input.nextShortName,
        nextFullName: input.nextFullName,
      });
    },
    periodAutoCreate(input) {
      logger.info(AUDIT_MESSAGE, {
        event: 'period.auto-create',
        userId: 'system',
        role: null,
        ip: 'cron',
        periodId: input.periodId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: input.deadline,
        from: input.from,
        to: input.to,
      });
    },
    periodAutoPublish(input) {
      logger.info(AUDIT_MESSAGE, {
        event: 'period.auto-publish',
        userId: 'system',
        role: null,
        ip: 'cron',
        periodId: input.periodId,
        missingSectionsCount: input.missingSectionsCount,
        from: input.from,
        to: input.to,
      });
    },
    periodAutoArchive(input) {
      logger.info(AUDIT_MESSAGE, {
        event: 'period.auto-archive',
        userId: 'system',
        role: null,
        ip: 'cron',
        periodId: input.periodId,
        from: input.from,
        to: input.to,
      });
    },
    periodManualCreate(input) {
      logger.info(AUDIT_MESSAGE, {
        event: 'period.manual-create',
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        periodId: input.periodId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: input.deadline,
        from: input.from,
        to: input.to,
      });
    },
  };
}

/** No-op AuditLogger for tests / harnesses that don't care about audit signal. */
export function createNullAuditLogger(): AuditLogger {
  return {
    loginSuccess() {
      /* noop */
    },
    loginFail() {
      /* noop */
    },
    logout() {
      /* noop */
    },
    roleDenied() {
      /* noop */
    },
    scopeDenied() {
      /* noop */
    },
    mutation() {
      /* noop */
    },
    policySave() {
      /* noop */
    },
    policyRemove() {
      /* noop */
    },
    organizationUpdate() {
      /* noop */
    },
    periodAutoCreate() {
      /* noop */
    },
    periodAutoPublish() {
      /* noop */
    },
    periodAutoArchive() {
      /* noop */
    },
    periodManualCreate() {
      /* noop */
    },
  };
}
