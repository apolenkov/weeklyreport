export type CrossAuthorReadResult = "allowed" | "denied" | "empty";
export type ReopenRequestState = "requested";

export interface ReportSectionsTelemetry {
  recordCrossAuthorRead(result: CrossAuthorReadResult): void;
  recordReopenRequest(state: ReopenRequestState): void;
  recordSectionSubmitted(late: boolean): void;
  observeSubmissionLatency(seconds: number): void;
}

export const REPORT_SECTIONS_TELEMETRY = Symbol("ReportSectionsTelemetry");

export const NOOP_REPORT_SECTIONS_TELEMETRY: ReportSectionsTelemetry = {
  recordCrossAuthorRead: () => undefined,
  recordReopenRequest: () => undefined,
  recordSectionSubmitted: () => undefined,
  observeSubmissionLatency: () => undefined,
};
