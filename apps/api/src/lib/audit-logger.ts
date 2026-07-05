import type { AuditEvent, AuditLogger } from "./audit-logger-types.js";
import type { AppLogger } from "./logger.js";

// AUTH-08 audit envelope + event types live in ./audit-logger-types (R3a-4
// max-lines split). Re-exported here so existing importers (main.ts,
// trpc.context, auth.routes, the period schedulers) are unaffected.
export type * from "./audit-logger-types.js";

/**
 * Composition-root DI tokens. `APP_LOGGER` resolves the single post-CLS
 * AppLogger (one shared file sink); `AUDIT_LOGGER` resolves the AuditLogger
 * built on it, so scheduled period transitions emit real audit lines instead
 * of a null-object no-op. Registered in config.module.ts.
 */
export const APP_LOGGER = Symbol("APP_LOGGER");
export const AUDIT_LOGGER = Symbol("AUDIT_LOGGER");

const AUDIT_MESSAGE = "audit";

/**
 * Build an AuditLogger that writes through the supplied AppLogger.
 *
 * Successes flow to `info`, denials and login failures flow to `warn` so the
 * default AppLogger configuration surfaces them at the operationally
 * appropriate level without any extra setup.
 */
export function createAuditLogger(logger: AppLogger): AuditLogger {
  // Every audit line flows through here so the compiler checks each `event`
  // string against the AuditEvent union — an undeclared or misspelled event is
  // a typecheck error at the call site. A bare `satisfies AuditEnvelope` cannot
  // do this: it rejects the per-event fields (periodId, changes, …) as excess
  // properties. The index signature carries those fields untyped instead.
  const emit = (
    level: "info" | "warn",
    payload: { event: AuditEvent } & Record<string, unknown>,
  ): void => {
    logger[level](AUDIT_MESSAGE, payload);
  };

  return {
    loginSuccess(input) {
      emit("info", {
        event: "login-success",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
      });
    },
    loginFail(input) {
      emit("warn", {
        event: "login-fail",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        reason: input.reason,
      });
    },
    logout(input) {
      emit("info", {
        event: "logout",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
      });
    },
    roleDenied(input) {
      emit("warn", {
        event: "role-denied",
        userId: input.userId,
        role: input.role,
        attemptedRole: input.attemptedRole,
        ip: input.ip,
      });
    },
    scopeDenied(input) {
      emit("warn", {
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
      emit(input.status === "success" ? "info" : "warn", {
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
      emit("info", {
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
      emit("info", {
        event: "admin.policy.remove",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        policyId: input.policyId,
      });
    },
    organizationUpdate(input) {
      emit("info", {
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
      emit("info", {
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
      emit("info", {
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
      emit("info", {
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
      emit("info", {
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
      emit("info", {
        event: "period.manual-edit",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        periodId: input.periodId,
        changes: input.changes,
      });
    },
    scopeAccessed(input) {
      emit("info", {
        event: "scope-accessed",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        accessedScope: input.accessedScope,
        productIds: input.productIds,
        groupIds: input.groupIds,
        resourceId: input.resourceId,
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
    scopeAccessed() {
      /* noop */
    },
  };
}
