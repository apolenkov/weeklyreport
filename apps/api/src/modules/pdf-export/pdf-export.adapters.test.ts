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
    const { enqueue } = enqueuer;

    await enqueue(
      { reportId: "report-1", jobId: "job-1", requestedBy: "user-1" },
      { traceparent: "trace", correlationId: "correlation" },
    );

    expect(queue.add).toHaveBeenCalledWith(
      "generate",
      {
        reportId: "report-1",
        jobId: "job-1",
        requestedBy: "user-1",
        traceparent: "trace",
        correlationId: "correlation",
      },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
  });

  it("serializes the job payload without any bearer credential", async () => {
    // The durable BullMQ job data must never contain a JWT-shaped credential
    // string — the worker mints the render token at execution time.
    const queue = { add: vi.fn().mockResolvedValue({ id: "job-1" }) };
    const enqueuer = new PdfExportBullmqEnqueuer(queue);
    const { enqueue } = enqueuer;

    await enqueue(
      { reportId: "report-1", jobId: "job-1", requestedBy: "user-1" },
      {},
    );

    const payload = JSON.stringify(queue.add.mock.calls[0]?.[1]);
    expect(payload).not.toContain("authToken");
    expect(payload).not.toMatch(/eyJ/);
  });

  it("captures the active correlation id through the telemetry port", () => {
    const cls = {
      isActive: () => true,
      get: () => "correlation",
    } as unknown as ClsService;
    const telemetry = new PdfExportInfrastructureTelemetry(cls);
    const { captureJobContext } = telemetry;

    expect(captureJobContext()).toEqual({
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

    const { captureJobContext } = new PdfExportInfrastructureTelemetry(cls);
    const context = captureJobContext();

    expect(context).toEqual({
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      correlationId: "correlation",
    });
  });

  it("records a request for the caller role", () => {
    const inc = vi
      .spyOn(customreportPdfExportRequestsTotal, "inc")
      .mockImplementation(() => undefined);

    const { recordRequest } = new PdfExportInfrastructureTelemetry(null);
    recordRequest("viewer");

    expect(inc).toHaveBeenCalledExactlyOnceWith({ role: "viewer" });
  });
});
