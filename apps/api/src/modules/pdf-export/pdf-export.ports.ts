export interface PdfExportJobContext {
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly correlationId?: string;
}

export interface PdfExportEnqueueInput {
  readonly reportId: string;
  readonly jobId: string;
  readonly authToken: string;
}

export interface PdfExportEnqueuer {
  enqueue(
    input: PdfExportEnqueueInput,
    context: PdfExportJobContext,
  ): Promise<void>;
}

export interface PdfExportTelemetry {
  captureJobContext(): PdfExportJobContext;
  recordRequest(role: string): void;
}

export const PDF_EXPORT_ENQUEUER = Symbol("PdfExportEnqueuer");
export const PDF_EXPORT_TELEMETRY = Symbol("PdfExportTelemetry");

export const NOOP_PDF_EXPORT_TELEMETRY: PdfExportTelemetry = {
  captureJobContext: () => ({}),
  recordRequest: () => undefined,
};
