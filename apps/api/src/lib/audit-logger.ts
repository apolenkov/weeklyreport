import {
  type AuditEmit,
  createAdminAuditEvents,
  createAuthAuditEvents,
  createAuthorizationAuditEvents,
  createMutationAuditEvents,
  createPeriodCronAuditEvents,
  createPeriodManualAuditEvents,
} from "./audit-logger-events.js";
import type { AuditLogger } from "./audit-logger-types.js";
import type { AppLogger } from "./logger.js";

export type * from "./audit-logger-types.js";

// Composition-root DI tokens (config.module.ts). AUDIT_LOGGER shares the
// post-CLS AppLogger so cron period transitions emit real audit lines.
export const APP_LOGGER = Symbol("APP_LOGGER");
export const AUDIT_LOGGER = Symbol("AUDIT_LOGGER");

const AUDIT_MESSAGE = "audit";

export function createAuditLogger(logger: AppLogger): AuditLogger {
  const emit: AuditEmit = (level, payload) => {
    logger[level](AUDIT_MESSAGE, payload);
  };

  return {
    ...createAuthAuditEvents(emit),
    ...createAuthorizationAuditEvents(emit),
    ...createMutationAuditEvents(emit),
    ...createAdminAuditEvents(emit),
    ...createPeriodCronAuditEvents(emit),
    ...createPeriodManualAuditEvents(emit),
  };
}
