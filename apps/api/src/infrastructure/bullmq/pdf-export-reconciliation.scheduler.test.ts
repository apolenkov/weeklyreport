import type { Job, Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { PdfExportReconciliationScheduler } from "./pdf-export-reconciliation.scheduler.js";

function job(input: {
  jobId: string;
  reportId?: string;
  requestedBy?: string;
  failedReason?: string;
  returnvalue?: unknown;
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
    returnvalue: input.returnvalue,
  } as unknown as Job<unknown>;
}

describe("PdfExportReconciliationScheduler", () => {
  it("reconciles failed and completed terminal jobs through the service", async () => {
    const reconcileTerminalState = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    const getJobs = vi.fn().mockResolvedValue([
      job({ jobId: "failed", failedReason: "browser crashed" }),
      job({
        jobId: "completed",
        returnvalue: { artifactUrl: "/pdfs/completed.pdf", checksum: "sha" },
      }),
    ]);
    const queue = { getJobs } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      { reconcileTerminalState } as never,
      { get: () => queue } as never,
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

  it("does not invent a completion when BullMQ has no artifact result", async () => {
    const reconcileTerminalState = vi.fn().mockResolvedValue(false);
    const queue = {
      getJobs: vi.fn().mockResolvedValue([job({ jobId: "no-result" })]),
    } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      { reconcileTerminalState } as never,
      { get: () => queue } as never,
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
      { reconcileTerminalState } as never,
      { get: () => queue } as never,
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).not.toHaveBeenCalled();
  });
});
