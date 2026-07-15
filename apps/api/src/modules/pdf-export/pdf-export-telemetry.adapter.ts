import type { ClsService } from "nestjs-cls";

import {
  captureJobTraceContext,
  resolveCorrelationId,
} from "../../infrastructure/bullmq/worker-observability.js";
import { customreportPdfExportRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import type {
  PdfExportJobContext,
  PdfExportTelemetry,
} from "./pdf-export.ports.js";

export class PdfExportInfrastructureTelemetry implements PdfExportTelemetry {
  constructor(private readonly cls: ClsService | undefined) {}

  captureJobContext(): PdfExportJobContext {
    return captureJobTraceContext(resolveCorrelationId(this.cls));
  }

  recordRequest(role: string): void {
    customreportPdfExportRequestsTotal.inc({ role });
  }
}
