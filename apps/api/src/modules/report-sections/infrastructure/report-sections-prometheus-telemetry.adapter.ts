import {
  weeklyreportCrossAuthorContentReadsTotal,
  weeklyreportReopenRequestsTotal,
  weeklyreportSectionsSubmittedTotal,
  weeklyreportSectionSubmissionLatencySeconds,
} from "../../../infrastructure/metrics/metrics.registry.js";
import type {
  CrossAuthorReadResult,
  ReopenRequestState,
  ReportSectionsTelemetry,
} from "../application/report-sections-telemetry.port.js";

export class ReportSectionsPrometheusTelemetry implements ReportSectionsTelemetry {
  readonly recordCrossAuthorRead = (result: CrossAuthorReadResult): void => {
    weeklyreportCrossAuthorContentReadsTotal.inc({ result });
  };

  readonly recordReopenRequest = (state: ReopenRequestState): void => {
    weeklyreportReopenRequestsTotal.inc({ state });
  };

  readonly recordSectionSubmitted = (late: boolean): void => {
    weeklyreportSectionsSubmittedTotal.inc({ late: String(late) });
  };

  readonly observeSubmissionLatency = (seconds: number): void => {
    weeklyreportSectionSubmissionLatencySeconds.observe(seconds);
  };
}
