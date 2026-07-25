import type { AuditEvent, AuditLogger } from "./audit-logger-types.js";
import type { AppLogger } from "./logger.js";

export type * from "./audit-logger-types.js";

// Composition-root DI tokens (config.module.ts). AUDIT_LOGGER shares the
// post-CLS AppLogger so cron period transitions emit real audit lines.
export const APP_LOGGER = Symbol("APP_LOGGER");
export const AUDIT_LOGGER = Symbol("AUDIT_LOGGER");

const AUDIT_MESSAGE = "audit";

export function createAuditLogger(logger: AppLogger): AuditLogger {
  // Funnel forces event against AuditEvent; satisfies-envelope would reject
  // per-event fields as excess properties.
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
      emit(input.status === "success" ? "info" : "warn", {
        event: "mutation",
        userId: input.userId,
        role: input.role,
        ip: input.ip,
        procedure: input.procedure,
        ...(input.target !== undefined ? { target: input.target } : {}),
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
