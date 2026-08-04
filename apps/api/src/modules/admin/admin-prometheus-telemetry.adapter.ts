import { customreportReopenRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import type {
  AdminTelemetry,
  ReopenRequestDecision,
} from "./admin-telemetry.port.js";

export class AdminPrometheusTelemetry implements AdminTelemetry {
  readonly recordReopenRequestDecision = (
    decision: ReopenRequestDecision,
  ): void => {
    customreportReopenRequestsTotal.inc({ state: decision });
  };
}
