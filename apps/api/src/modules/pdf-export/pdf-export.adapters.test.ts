import { propagation } from "@opentelemetry/api";
import type { ClsService } from "nestjs-cls";
import { afterEach, describe, expect, it, vi } from "vitest";

import { customreportPdfExportRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import { PdfExportBullmqEnqueuer } from "./pdf-export-bullmq-enqueuer.adapter.js";
import { PdfExportInfrastructureTelemetry } from "./pdf-export-telemetry.adapter.js";

describe("PDF export infrastructure adapters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("captures an injected traceparent with the correlation id", () => {
    vi.spyOn(propagation, "inject").mockImplementation((_context, carrier) => {
      Object.assign(carrier as object, {
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      });
    });
    const cls = {
      isActive: () => true,
      get: () => "correlation",
    } as unknown as ClsService;

    const context = new PdfExportInfrastructureTelemetry(
      cls,
    ).captureJobContext();

    expect(context).toEqual({
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      correlationId: "correlation",
    });
  });

  it("records a request for the caller role", () => {
    const inc = vi
      .spyOn(customreportPdfExportRequestsTotal, "inc")
      .mockImplementation(() => undefined);

    new PdfExportInfrastructureTelemetry(undefined).recordRequest("viewer");

    expect(inc).toHaveBeenCalledExactlyOnceWith({ role: "viewer" });
  });
});
