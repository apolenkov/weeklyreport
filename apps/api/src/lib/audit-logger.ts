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
 *    even when role/userId are unknown ('unknown' / 'anonymous' literals).
 *  - T3: ip is captured upstream from `req.ip` (Express trust-proxy aware),
 *    never from raw X-Forwarded-For; this module is a pure consumer.
 */
export type AuditEvent = 'login-success' | 'login-fail' | 'logout' | 'role-denied';

export type AuditEnvelope = {
  readonly event: AuditEvent;
  readonly userId: string;
  readonly role: Role | 'unknown';
  readonly attemptedRole?: ReadonlyArray<Role> | Role;
  readonly ip: string;
};

type LoginSuccessInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'>;
type LoginFailInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'> & {
  readonly reason: string;
};
type LogoutInput = Omit<AuditEnvelope, 'event' | 'attemptedRole'>;
type RoleDeniedInput = Omit<AuditEnvelope, 'event'>;

export interface AuditLogger {
  loginSuccess(input: LoginSuccessInput): void;
  loginFail(input: LoginFailInput): void;
  logout(input: LogoutInput): void;
  roleDenied(input: RoleDeniedInput): void;
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
  };
}
