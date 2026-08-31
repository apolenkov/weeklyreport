import type { PdfExportTelemetry } from "../modules/pdf-export/pdf-export.ports.js";

export const NOOP_PDF_EXPORT_TELEMETRY: PdfExportTelemetry = {
  captureJobContext: () => ({}),
  recordRequest: () => undefined,
};
