import type { ClsService } from "nestjs-cls";
import { describe, expect, it, vi } from "vitest";

import { RemindersBullmqEnqueuer } from "./reminders-bullmq-enqueuer.adapter.js";
import { RemindersInfrastructureTelemetry } from "./reminders-telemetry.adapter.js";

describe("reminders infrastructure adapters", () => {
  it("preserves the queue payload, trace context, retry options, and job id", async () => {
    const queue = { add: vi.fn().mockResolvedValue({ id: "execution-1" }) };
    const enqueuer = new RemindersBullmqEnqueuer(queue);

    await enqueuer.enqueue(
      "execution-1",
      { recipientEmail: "lead@example.com", reportPeriod: "Week 1" },
      { tracestate: "state", correlationId: "correlation" },
    );

    expect(queue.add).toHaveBeenCalledWith(
      "send",
      {
        recipientEmail: "lead@example.com",
        reportPeriod: "Week 1",
        tracestate: "state",
        correlationId: "correlation",
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        jobId: "execution-1",
      },
    );
  });

  it("captures the active correlation id through the telemetry port", () => {
    const cls = {
      isActive: () => true,
      get: () => "correlation",
    } as unknown as ClsService;
    const telemetry = new RemindersInfrastructureTelemetry(cls);

    expect(telemetry.captureJobContext()).toEqual({
      correlationId: "correlation",
    });
  });

  it("returns empty context outside an active CLS scope", () => {
    const telemetry = new RemindersInfrastructureTelemetry(undefined);

    expect(telemetry.captureJobContext()).toEqual({});
  });
});
