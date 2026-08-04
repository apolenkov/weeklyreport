export type CrossAuthorReadResult = "allowed" | "denied" | "empty";
export type ReopenRequestState = "requested";

export interface ReportSectionsTelemetry {
  readonly recordCrossAuthorRead: (result: CrossAuthorReadResult) => void;
  readonly recordReopenRequest: (state: ReopenRequestState) => void;
  readonly recordSectionSubmitted: (late: boolean) => void;
  readonly observeSubmissionLatency: (seconds: number) => void;
}

export const REPORT_SECTIONS_TELEMETRY = Symbol("ReportSectionsTelemetry");

export const NOOP_REPORT_SECTIONS_TELEMETRY: ReportSectionsTelemetry = {
  recordCrossAuthorRead: () => undefined,
  recordReopenRequest: () => undefined,
  recordSectionSubmitted: () => undefined,
  observeSubmissionLatency: () => undefined,
};
