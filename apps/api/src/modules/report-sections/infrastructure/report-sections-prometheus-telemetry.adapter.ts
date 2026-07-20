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
  recordCrossAuthorRead(result: CrossAuthorReadResult): void {
    customreportCrossAuthorContentReadsTotal.inc({ result });
  }

  recordReopenRequest(state: ReopenRequestState): void {
    customreportReopenRequestsTotal.inc({ state });
  }

  recordSectionSubmitted(late: boolean): void {
    customreportSectionsSubmittedTotal.inc({ late: String(late) });
  }

  observeSubmissionLatency(seconds: number): void {
    customreportSectionSubmissionLatencySeconds.observe(seconds);
  }
}
