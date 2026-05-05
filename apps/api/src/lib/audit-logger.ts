import type { Role } from '@customreport/shared';

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
  | 'mutation';

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

export interface AuditLogger {
  loginSuccess(input: LoginSuccessInput): void;
  loginFail(input: LoginFailInput): void;
  logout(input: LogoutInput): void;
  roleDenied(input: RoleDeniedInput): void;
  mutation(input: MutationInput): void;
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
    mutation() {
      /* noop */
    },
  };
}
