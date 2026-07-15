import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../../infrastructure/metrics/metrics.registry.js";
import type {
  PublicationSourceState,
  PublicationTelemetry,
} from "../application/publication-telemetry.port.js";

export class PublicationPrometheusTelemetry implements PublicationTelemetry {
  recordPublishedReport(): void {
    customreportReportsSubmittedTotal.inc({ state: "published" });
  }

  recordPeriodPublished(from: PublicationSourceState): void {
    customreportPeriodStateTransitionsTotal.inc({ from, to: "published" });
  }
}
