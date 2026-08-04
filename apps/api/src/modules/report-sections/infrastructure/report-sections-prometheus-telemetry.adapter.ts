import {
  customreportCrossAuthorContentReadsTotal,
  customreportReopenRequestsTotal,
  customreportSectionsSubmittedTotal,
  customreportSectionSubmissionLatencySeconds,
} from "../../../infrastructure/metrics/metrics.registry.js";
import type {
  CrossAuthorReadResult,
  ReopenRequestState,
  ReportSectionsTelemetry,
} from "../application/report-sections-telemetry.port.js";

export class ReportSectionsPrometheusTelemetry implements ReportSectionsTelemetry {
  readonly recordCrossAuthorRead = (result: CrossAuthorReadResult): void => {
    customreportCrossAuthorContentReadsTotal.inc({ result });
  };

  readonly recordReopenRequest = (state: ReopenRequestState): void => {
    customreportReopenRequestsTotal.inc({ state });
  };

  readonly recordSectionSubmitted = (late: boolean): void => {
    customreportSectionsSubmittedTotal.inc({ late: String(late) });
  };

  readonly observeSubmissionLatency = (seconds: number): void => {
    customreportSectionSubmissionLatencySeconds.observe(seconds);
  };
}
