import type { ClsService } from "nestjs-cls";
import { describe, expect, it, vi } from "vitest";

import { RemindersBullmqEnqueuer } from "./reminders-bullmq-enqueuer.adapter.js";
import { RemindersInfrastructureTelemetry } from "./reminders-telemetry.adapter.js";

describe("reminders infrastructure adapters", () => {
  it("preserves the queue payload, trace context, retry options, and job id", async () => {
    const queue = { add: vi.fn().mockResolvedValue({ id: "execution-1" }) };
    const enqueuer = new RemindersBullmqEnqueuer(queue);
    const { enqueue } = enqueuer;

    await enqueue(
      "execution-1",
      {
        contractVersion: 1,
        executionId: "execution-1",
        recipientEmail: "lead@example.com",
        kind: "deadline",
        cycleDate: "2026-04-07",
        leadName: "Lead",
        reportPeriod: "Week 1",
        deadlineIso: "2026-04-07T09:00:00.000Z",
        sectionUrl: "https://example.test/lead/report",
        organization: { shortName: "ORG", fullName: "Organization" },
      },
      { tracestate: "state", correlationId: "correlation" },
    );

    expect(queue.add).toHaveBeenCalledWith(
      "send",
      {
        contractVersion: 1,
        executionId: "execution-1",
        recipientEmail: "lead@example.com",
        kind: "deadline",
        cycleDate: "2026-04-07",
        leadName: "Lead",
        reportPeriod: "Week 1",
        deadlineIso: "2026-04-07T09:00:00.000Z",
        sectionUrl: "https://example.test/lead/report",
        organization: { shortName: "ORG", fullName: "Organization" },
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

  it("replaces a retained terminal job during reaper recovery", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const getState = vi.fn().mockResolvedValue("failed");
    const queue = {
      getJob: vi.fn().mockResolvedValue({ getState, remove }),
      add: vi.fn().mockResolvedValue({ id: "execution-1" }),
    };
    const enqueuer = new RemindersBullmqEnqueuer(queue);

    await enqueuer.enqueue(
      "execution-1",
      {
        contractVersion: 1,
        executionId: "execution-1",
        recipientEmail: "lead@example.com",
        kind: "deadline",
        cycleDate: "2026-04-07",
        leadName: "Lead",
        reportPeriod: "Week 1",
        deadlineIso: "2026-04-07T09:00:00.000Z",
        sectionUrl: "https://example.test/lead/report",
        organization: { shortName: "ORG", fullName: "Organization" },
      },
      {},
      { replaceTerminal: true },
    );

    expect(getState).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(queue.add).toHaveBeenCalledOnce();
  });

  it("does not remove an active job during recovery", async () => {
    const remove = vi.fn();
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        getState: vi.fn().mockResolvedValue("active"),
        remove,
      }),
      add: vi.fn(),
    };
    const enqueuer = new RemindersBullmqEnqueuer(queue);

    await expect(
      enqueuer.enqueue(
        "execution-1",
        {
          contractVersion: 1,
          executionId: "execution-1",
          recipientEmail: "lead@example.com",
          kind: "deadline",
          cycleDate: "2026-04-07",
          leadName: "Lead",
          reportPeriod: "Week 1",
          deadlineIso: "2026-04-07T09:00:00.000Z",
          sectionUrl: "https://example.test/lead/report",
          organization: { shortName: "ORG", fullName: "Organization" },
        },
        {},
        { replaceTerminal: true },
      ),
    ).rejects.toThrow("non-terminal reminder job");
    expect(remove).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("captures the active correlation id through the telemetry port", () => {
    const cls = {
      isActive: () => true,
      get: () => "correlation",
    } as unknown as ClsService;
    const telemetry = new RemindersInfrastructureTelemetry(cls);
    const { captureJobContext } = telemetry;

    expect(captureJobContext()).toEqual({
      correlationId: "correlation",
    });
  });

  it("returns empty context outside an active CLS scope", () => {
    const telemetry = new RemindersInfrastructureTelemetry(null);
    const { captureJobContext } = telemetry;

    expect(captureJobContext()).toEqual({});
  });
});
