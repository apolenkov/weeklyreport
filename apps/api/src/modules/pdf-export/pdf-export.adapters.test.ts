import type { ClsService } from "nestjs-cls";
import { describe, expect, it, vi } from "vitest";

import { PdfExportBullmqEnqueuer } from "./pdf-export-bullmq-enqueuer.adapter.js";
import { PdfExportInfrastructureTelemetry } from "./pdf-export-telemetry.adapter.js";

describe("PDF export infrastructure adapters", () => {
  it("preserves the queue payload, trace context, and retry options", async () => {
    const queue = { add: vi.fn().mockResolvedValue({ id: "job-1" }) };
    const enqueuer = new PdfExportBullmqEnqueuer(queue);

    await enqueuer.enqueue(
      { reportId: "report-1", jobId: "job-1", authToken: "token" },
      { traceparent: "trace", correlationId: "correlation" },
    );

    expect(queue.add).toHaveBeenCalledWith(
      "generate",
      {
        reportId: "report-1",
        jobId: "job-1",
        authToken: "token",
        traceparent: "trace",
        correlationId: "correlation",
      },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
  });

  it("captures the active correlation id through the telemetry port", () => {
    const cls = {
      isActive: () => true,
      get: () => "correlation",
    } as unknown as ClsService;
    const telemetry = new PdfExportInfrastructureTelemetry(cls);

    expect(telemetry.captureJobContext()).toEqual({
      correlationId: "correlation",
    });
  });
});
