export interface PdfExportJobContext {
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly correlationId?: string;
}

export interface PdfExportEnqueueInput {
  readonly reportId: string;
  readonly jobId: string;
  // Non-credential requester identity; the worker mints a short-lived render
  // token from it at execution time, never from a persisted credential.
  readonly requestedBy: string;
}

export interface PdfExportEnqueuer {
  readonly enqueue: (
    input: PdfExportEnqueueInput,
    context: PdfExportJobContext,
  ) => Promise<void>;
}

export interface PdfExportTelemetry {
  readonly captureJobContext: () => PdfExportJobContext;
  readonly recordRequest: (role: string) => void;
}

export const PDF_EXPORT_ENQUEUER = Symbol("PdfExportEnqueuer");
export const PDF_EXPORT_TELEMETRY = Symbol("PdfExportTelemetry");

export const NOOP_PDF_EXPORT_TELEMETRY: PdfExportTelemetry = {
  captureJobContext: () => ({}),
  recordRequest: () => undefined,
};
