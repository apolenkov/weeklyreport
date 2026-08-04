import type { PeriodStatus } from "@customreport/shared";

import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../../infrastructure/metrics/metrics.registry.js";
import type { PeriodTelemetry } from "../application/period-telemetry.port.js";

export class PeriodPrometheusTelemetry implements PeriodTelemetry {
  readonly recordPublishedReport = (): void => {
    customreportReportsSubmittedTotal.inc({ state: "published" });
  };

  readonly recordPeriodPublished = (from: PeriodStatus): void => {
    customreportPeriodStateTransitionsTotal.inc({ from, to: "published" });
  };
}
