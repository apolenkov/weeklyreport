import type { AuditEvent, AuditLogger } from "./audit-logger-types.js";

// Funnel forces event against AuditEvent; satisfies-envelope would reject
// per-event fields as excess properties.
export type AuditEmit = (
  level: "info" | "warn",
  payload: { event: AuditEvent } & Record<string, unknown>,
) => void;

export function createAuthAuditEvents(
  emit: AuditEmit,
): Pick<AuditLogger, "loginSuccess" | "loginFail" | "logout"> {
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
  };
}

export function createAuthorizationAuditEvents(
  emit: AuditEmit,
): Pick<AuditLogger, "roleDenied" | "scopeDenied" | "scopeAccessed"> {
  return {
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

export function createMutationAuditEvents(
  emit: AuditEmit,
): Pick<AuditLogger, "mutation"> {
  return {
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
  };
}

export function createAdminAuditEvents(
  emit: AuditEmit,
): Pick<AuditLogger, "policySave" | "policyRemove" | "organizationUpdate"> {
  return {
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
  };
}

// Cron-driven transitions have no actor; the envelope's actor fields carry the
// scheduler identity instead of a request principal.
const CRON_ACTOR = { userId: "system", role: null, ip: "cron" } as const;

export function createPeriodCronAuditEvents(
  emit: AuditEmit,
): Pick<
  AuditLogger,
  "periodAutoCreate" | "periodAutoPublish" | "periodAutoArchive"
> {
  return {
    periodAutoCreate(input) {
      emit("info", {
        event: "period.auto-create",
        ...CRON_ACTOR,
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
        ...CRON_ACTOR,
        periodId: input.periodId,
        missingSectionsCount: input.missingSectionsCount,
        from: input.from,
        to: input.to,
      });
    },
    periodAutoArchive(input) {
      emit("info", {
        event: "period.auto-archive",
        ...CRON_ACTOR,
        periodId: input.periodId,
        from: input.from,
        to: input.to,
      });
    },
  };
}

export function createPeriodManualAuditEvents(
  emit: AuditEmit,
): Pick<AuditLogger, "periodManualCreate" | "periodManualEdit"> {
  return {
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
  };
}
