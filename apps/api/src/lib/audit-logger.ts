import type { AuditLogger } from "./audit-logger-types.js";
import type { AppLogger } from "./logger.js";

// AUTH-08 audit envelope + event types live in ./audit-logger-types (R3a-4
// max-lines split). Re-exported here so existing importers (main.ts,
// trpc.context, auth.routes, the period schedulers) are unaffected.
export type * from "./audit-logger-types.js";

const AUDIT_MESSAGE = "audit";

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
        event: "login-success",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
      });
    },
    loginFail(input) {
      logger.warn(AUDIT_MESSAGE, {
        event: "login-fail",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        reason: input.reason,
      });
    },
    logout(input) {
      logger.info(AUDIT_MESSAGE, {
        event: "logout",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
      });
    },
    roleDenied(input) {
      logger.warn(AUDIT_MESSAGE, {
        event: "role-denied",
        userId: input.userId,
        role: input.role,
        attemptedRole: input.attemptedRole,
        ip: input.ip,
      });
    },
    scopeDenied(input) {
      logger.warn(AUDIT_MESSAGE, {
        event: "scope-denied",
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
      const level = input.status === "success" ? "info" : "warn";
      logger[level](AUDIT_MESSAGE, {
        event: "mutation",
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
        event: "admin.policy.save",
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
        event: "admin.policy.remove",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        policyId: input.policyId,
      });
    },
    organizationUpdate(input) {
      logger.info(AUDIT_MESSAGE, {
        event: "admin.organization.update",
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
        event: "period.auto-create",
        userId: "system",
        role: null,
        ip: "cron",
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
        event: "period.auto-publish",
        userId: "system",
        role: null,
        ip: "cron",
        periodId: input.periodId,
        missingSectionsCount: input.missingSectionsCount,
        from: input.from,
        to: input.to,
      });
    },
    periodAutoArchive(input) {
      logger.info(AUDIT_MESSAGE, {
        event: "period.auto-archive",
        userId: "system",
        role: null,
        ip: "cron",
        periodId: input.periodId,
        from: input.from,
        to: input.to,
      });
    },
    periodManualCreate(input) {
      logger.info(AUDIT_MESSAGE, {
        event: "period.manual-create",
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
    periodManualEdit(input) {
      logger.info(AUDIT_MESSAGE, {
        event: "period.manual-edit",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        periodId: input.periodId,
        changes: input.changes,
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
    periodManualEdit() {
      /* noop */
    },
  };
}
