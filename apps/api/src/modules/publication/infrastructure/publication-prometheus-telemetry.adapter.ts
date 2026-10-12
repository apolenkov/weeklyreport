import {
  weeklyreportPeriodStateTransitionsTotal,
  weeklyreportReportsSubmittedTotal,
} from "../../../infrastructure/metrics/metrics.registry.js";
import type {
  PublicationSourceState,
  PublicationTelemetry,
} from "../application/publication-telemetry.port.js";

export class PublicationPrometheusTelemetry implements PublicationTelemetry {
  readonly recordPublishedReport = (): void => {
    weeklyreportReportsSubmittedTotal.inc({ state: "published" });
  };

  readonly recordPeriodPublished = (from: PublicationSourceState): void => {
    weeklyreportPeriodStateTransitionsTotal.inc({ from, to: "published" });
  };
}
