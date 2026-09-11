import { Logger } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PdfExportReconciliationScheduler } from "./pdf-export-reconciliation.scheduler.js";

function job(input: {
  jobId: string;
  reportId?: string;
  requestedBy?: string;
  failedReason?: string;
  returnvalue?: unknown;
  state?: Awaited<ReturnType<Job["getState"]>>;
  stateError?: Error;
}): Job<unknown> {
  return {
    id: input.jobId,
    data: {
      jobId: input.jobId,
      reportId: input.reportId ?? "report-1",
      requestedBy: input.requestedBy ?? "user-1",
    },
    failedReason: input.failedReason,
    finishedOn: Date.now(),
    getState: input.stateError
      ? vi.fn().mockRejectedValue(input.stateError)
      : vi
          .fn()
          .mockResolvedValue(
            input.state ?? (input.failedReason ? "failed" : "completed"),
          ),
    returnvalue: input.returnvalue,
  } as unknown as Job<unknown>;
}

describe("PdfExportReconciliationScheduler", () => {
  afterEach(() => vi.restoreAllMocks());

  it("handles a startup queue failure and retries on the scheduled pass", async () => {
    const logError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const reconcileTerminalState = vi.fn();
    const getJobs = vi
      .fn<Queue["getJobs"]>()
      .mockRejectedValueOnce(new Error("Queue unavailable"))
      .mockResolvedValueOnce([]);
    const queue = { getJobs } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      { reconcileTerminalState },
      { get: () => queue },
    );

    scheduler.onModuleInit();
    await vi.waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        "pdf-export startup reconciliation failed",
        { error: "Queue unavailable" },
      );
    });
    await expect(scheduler.reconcileTerminalJobs()).resolves.toBeUndefined();
    expect(getJobs).toHaveBeenCalledTimes(2);
    expect(reconcileTerminalState).not.toHaveBeenCalled();
  });

  it("reconciles failed and completed terminal jobs through the service", async () => {
    const reconcileTerminalState = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    const getJobs = vi.fn().mockResolvedValue([
      job({
        jobId: "failed",
        state: "failed",
        failedReason: "browser crashed",
      }),
      job({
        jobId: "completed",
        returnvalue: { artifactUrl: "/pdfs/completed.pdf", checksum: "sha" },
      }),
    ]);
    const queue = { getJobs } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      { reconcileTerminalState },
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(getJobs).toHaveBeenCalledWith(["completed", "failed"], 0, 999);
    expect(reconcileTerminalState).toHaveBeenNthCalledWith(1, {
      jobId: "failed",
      reportId: "report-1",
      requestedBy: "user-1",
      status: "failed",
      error: "browser crashed",
    });
    expect(reconcileTerminalState).toHaveBeenNthCalledWith(2, {
      jobId: "completed",
      reportId: "report-1",
      requestedBy: "user-1",
      status: "completed",
      artifactUrl: "/pdfs/completed.pdf",
      checksum: "sha",
    });
  });

  it("reconciles a completed retry even when BullMQ retains its earlier failure reason", async () => {
    const reconcileTerminalState = vi.fn().mockResolvedValue(true);
    const queue = {
      getJobs: vi.fn().mockResolvedValue([
        job({
          jobId: "retry-completed",
          state: "completed",
          failedReason: "browser crashed on the first attempt",
          returnvalue: {
            artifactUrl: "/pdfs/retry-completed.pdf",
            checksum: "sha-retry",
          },
        }),
      ]),
    } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      { reconcileTerminalState },
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).toHaveBeenCalledWith({
      jobId: "retry-completed",
      reportId: "report-1",
      requestedBy: "user-1",
      status: "completed",
      artifactUrl: "/pdfs/retry-completed.pdf",
      checksum: "sha-retry",
    });
  });

  it("does not invent a completion when BullMQ has no artifact result", async () => {
    const reconcileTerminalState = vi.fn().mockResolvedValue(false);
    const queue = {
      getJobs: vi.fn().mockResolvedValue([job({ jobId: "no-result" })]),
    } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      { reconcileTerminalState },
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).toHaveBeenCalledWith({
      jobId: "no-result",
      reportId: "report-1",
      requestedBy: "user-1",
      status: "completed",
    });
  });

  it("skips a stale queue payload whose id or identity is mismatched", async () => {
    const reconcileTerminalState = vi.fn();
    const queue = {
      getJobs: vi
        .fn()
        .mockResolvedValue([
          { ...job({ jobId: "payload-id" }), id: "redis-id" },
        ]),
    } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      { reconcileTerminalState },
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).not.toHaveBeenCalled();
  });

  it("skips a retry that is no longer terminal despite a stale finishedOn", async () => {
    const reconcileTerminalState = vi.fn();
    const queue = {
      getJobs: vi.fn().mockResolvedValue([
        job({
          jobId: "retry-active",
          state: "active",
          failedReason: "browser crashed on the first attempt",
        }),
      ]),
    } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      { reconcileTerminalState },
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).not.toHaveBeenCalled();
  });

  it("isolates a state lookup failure and reconciles the valid sibling", async () => {
    const logError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const reconcileTerminalState = vi.fn().mockResolvedValue(true);
    const queue = {
      getJobs: vi.fn().mockResolvedValue([
        job({
          jobId: "state-unavailable",
          stateError: new Error("Redis lookup failed"),
        }),
        job({
          jobId: "completed-sibling",
          state: "completed",
          returnvalue: {
            artifactUrl: "/pdfs/completed-sibling.pdf",
            checksum: "sha-sibling",
          },
        }),
      ]),
    } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      { reconcileTerminalState },
      { get: () => queue },
    );

    await expect(scheduler.runOnce()).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(
      "pdf-export terminal reconciliation failed",
      { jobId: "state-unavailable", error: "Redis lookup failed" },
    );
    expect(reconcileTerminalState).toHaveBeenCalledOnce();
    expect(reconcileTerminalState).toHaveBeenCalledWith({
      jobId: "completed-sibling",
      reportId: "report-1",
      requestedBy: "user-1",
      status: "completed",
      artifactUrl: "/pdfs/completed-sibling.pdf",
      checksum: "sha-sibling",
    });
  });
});
