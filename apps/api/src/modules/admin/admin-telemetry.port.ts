export type ReopenRequestDecision = "approved" | "rejected";

export interface AdminTelemetry {
  recordReopenRequestDecision(decision: ReopenRequestDecision): void;
}

export const ADMIN_TELEMETRY = Symbol("AdminTelemetry");

export const NOOP_ADMIN_TELEMETRY: AdminTelemetry = {
  recordReopenRequestDecision: () => undefined,
};
