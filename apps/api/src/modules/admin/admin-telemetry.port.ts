export type ReopenRequestDecision = "approved" | "rejected";

export interface AdminTelemetry {
  readonly recordReopenRequestDecision: (
    decision: ReopenRequestDecision,
  ) => void;
}

export const ADMIN_TELEMETRY = Symbol("AdminTelemetry");
