import type { AuditLogger } from "../lib/audit-logger-types.js";

export type { AuditLogger } from "../lib/audit-logger-types.js";

const noop = (): void => undefined;

export function createNullAuditLogger(): AuditLogger {
  return {
    loginSuccess: noop,
    loginFail: noop,
    logout: noop,
    roleDenied: noop,
    scopeDenied: noop,
    mutation: noop,
    policySave: noop,
    policyRemove: noop,
    organizationUpdate: noop,
    periodAutoCreate: noop,
    periodAutoPublish: noop,
    periodAutoArchive: noop,
    periodManualCreate: noop,
    periodManualEdit: noop,
    scopeAccessed: noop,
  };
}
