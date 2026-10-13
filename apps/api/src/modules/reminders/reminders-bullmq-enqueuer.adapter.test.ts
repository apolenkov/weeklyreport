import { describe, expect, it, vi } from "vitest";

import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import type { TerminalJobRemoval } from "../../infrastructure/bullmq/terminal-job-removal.js";
import { RemindersBullmqEnqueuer } from "./reminders-bullmq-enqueuer.adapter.js";
import type { ReminderQueueJobData } from "./reminders-queue-payload.js";

const queueData: ReminderQueueJobData = {
  contractVersion: 1,
  executionId: "execution-1",
  recipientEmail: "lead@example.test",
  kind: "deadline",
  cycleDate: "2026-04-11",
  leadName: "Test Lead",
  reportPeriod: "2026-04-06 → 2026-04-12",
  deadlineIso: "2026-04-11T00:00:00.000Z",
  sectionUrl: "https://example.test/lead/report",
  organization: {
    shortName: "WeeklyReport",
    fullName: "WeeklyReport Department",
  },
};

describe("RemindersBullmqEnqueuer", () => {
  it("preserves the payload, trace context, and retry options", async () => {
    const queue = {
      add: vi.fn().mockResolvedValue({ id: queueData.executionId }),
    } satisfies JobEnqueuer;
    const enqueuer = new RemindersBullmqEnqueuer(queue, {
      getJob: vi
        .fn<TerminalJobRemoval["getJob"]>()
        .mockResolvedValue(undefined),
    });

    await enqueuer.enqueue(queueData.executionId, queueData, {
      traceparent: "trace",
      correlationId: "correlation",
    });

    expect(queue.add).toHaveBeenCalledWith(
      "send",
      {
        ...queueData,
        traceparent: "trace",
        correlationId: "correlation",
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        jobId: queueData.executionId,
      },
    );
  });

  it("replaces a terminal job before enqueueing a recovery attempt", async () => {
    const removeIfTerminal = vi.fn().mockResolvedValue("removed");
    const getState = vi.fn().mockResolvedValue("failed");
    const getJob = vi.fn().mockResolvedValue({ getState, removeIfTerminal });
    const queue = {
      add: vi.fn().mockResolvedValue({ id: queueData.executionId }),
      getJob,
    } satisfies JobEnqueuer;
    const enqueuer = new RemindersBullmqEnqueuer(queue, { getJob });

    await enqueuer.enqueue(
      queueData.executionId,
      queueData,
      {},
      { replaceTerminal: true },
    );

    expect(getJob).toHaveBeenCalledWith(queueData.executionId);
    expect(getState).toHaveBeenCalledOnce();
    expect(removeIfTerminal).toHaveBeenCalledWith("failed-or-completed");
    expect(queue.add).toHaveBeenCalledOnce();
  });

  it("rejects replacement of a non-terminal job", async () => {
    const queue = {
      add: vi.fn(),
      getJob: vi.fn().mockResolvedValue({
        getState: vi.fn().mockResolvedValue("active"),
        removeIfTerminal: vi.fn(),
      }),
    } satisfies JobEnqueuer;
    const enqueuer = new RemindersBullmqEnqueuer(queue, {
      getJob: queue.getJob,
    });

    await expect(
      enqueuer.enqueue(
        queueData.executionId,
        queueData,
        {},
        { replaceTerminal: true },
      ),
    ).rejects.toThrow(
      "Cannot replace non-terminal reminder job execution-1 in active state.",
    );
    expect(queue.add).not.toHaveBeenCalled();
  });
});
