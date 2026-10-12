import type { PeriodStatus } from "@weeklyreport/shared";

import {
  weeklyreportPeriodStateTransitionsTotal,
  weeklyreportReportsSubmittedTotal,
} from "../../../infrastructure/metrics/metrics.registry.js";
import type { PeriodTelemetry } from "../application/period-telemetry.port.js";

export class PeriodPrometheusTelemetry implements PeriodTelemetry {
  readonly recordPublishedReport = (): void => {
    weeklyreportReportsSubmittedTotal.inc({ state: "published" });
  };

  readonly recordPeriodPublished = (from: PeriodStatus): void => {
    weeklyreportPeriodStateTransitionsTotal.inc({ from, to: "published" });
  };
}
