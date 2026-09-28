import { Logger } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PdfExportJobIdentity,
  PdfExportPendingCandidate,
  PdfExportTerminalState,
} from "../../modules/pdf-export/index.js";
import { PdfExportReconciliationScheduler } from "./pdf-export-reconciliation.scheduler.js";

type ReconcileTerminalState = (
  identity: PdfExportJobIdentity,
  loadCurrentTerminalState: () => Promise<PdfExportTerminalState | null>,
) => Promise<boolean>;

// The service owns candidate paging and the quarantine write; runOnce hands
// it a live probe answering whether `${jobId}-g${generation}` is in the queue.
type OrphanQueueProbe = (
  candidate: Pick<PdfExportPendingCandidate, "jobId" | "generation">,
) => Promise<boolean>;
type ScanOrphanedPendingExports = (
  hasQueueJob: OrphanQueueProbe,
) => Promise<unknown>;

function job(input: {
  jobId: string;
  generation?: number;
  omitGeneration?: boolean;
  queueId?: string | undefined;
  reportId?: string;
  requestedBy?: string;
  failedReason?: string;
  returnvalue?: unknown;
  state?: Awaited<ReturnType<Job["getState"]>>;
  stateError?: Error;
}): Job<unknown> {
  const generation = input.omitGeneration ? undefined : (input.generation ?? 1);
  return {
    // `in` keeps an explicit `undefined` — an id-less delivery — distinct
    // from an omitted option that defaults to the dispatch-correct id.
    id:
      "queueId" in input
        ? input.queueId
        : generation === undefined
          ? input.jobId
          : `${input.jobId}-g${generation}`,
    data: {
      jobId: input.jobId,
      reportId: input.reportId ?? "report-1",
      requestedBy: input.requestedBy ?? "user-1",
      ...(generation === undefined ? {} : { generation }),
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

// `listed` is what getJobs(["completed","failed"]) captured; `current` is what
// a fresh getJob returns when the loader runs inside the row lock — the two
// can disagree once a retry moved the job on.
function queueWith(
  listed: Job<unknown>[],
  current?: ReadonlyMap<string, Job<unknown>>,
): Queue {
  const byId =
    current ?? new Map(listed.map((entry) => [entry.id, entry] as const));
  return {
    getJobs: vi.fn().mockResolvedValue(listed),
    getJob: vi.fn((id: string) => Promise.resolve(byId.get(id))),
  } as unknown as Queue;
}

// Mimics the service contract: the loader runs inside the lock and a null
// result declines the write. Keeps the loader results inspectable.
function recordingReconcile(loaderResults: unknown[]) {
  return vi
    .fn<ReconcileTerminalState>()
    .mockImplementation(async (_identity, loadCurrentTerminalState) => {
      const state = await loadCurrentTerminalState();
      loaderResults.push(state);
      return state !== null;
    });
}

// runOnce exercises both passes; each test overrides only the collaborator
// under scrutiny. The default scan resolves without probing the queue.
function service(overrides: {
  reconcileTerminalState?: ReconcileTerminalState;
  scanOrphanedPendingExports?: ScanOrphanedPendingExports;
}) {
  return {
    reconcileTerminalState:
      overrides.reconcileTerminalState ?? vi.fn<ReconcileTerminalState>(),
    scanOrphanedPendingExports:
      overrides.scanOrphanedPendingExports ??
      vi.fn<ScanOrphanedPendingExports>().mockResolvedValue(undefined),
  };
}

describe("PdfExportReconciliationScheduler", () => {
  afterEach(() => vi.restoreAllMocks());

  it("handles a startup queue failure and retries on the scheduled pass", async () => {
    const logError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const reconcileTerminalState = vi.fn<ReconcileTerminalState>();
    const getJobs = vi
      .fn<Queue["getJobs"]>()
      .mockRejectedValueOnce(new Error("Queue unavailable"))
      .mockResolvedValueOnce([]);
    const queue = { getJobs } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
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
    const loaderResults: unknown[] = [];
    const reconcileTerminalState = recordingReconcile(loaderResults);
    const queue = queueWith([
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
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(queue.getJobs).toHaveBeenCalledWith(["completed", "failed"], 0, 999);
    expect(reconcileTerminalState).toHaveBeenNthCalledWith(
      1,
      {
        jobId: "failed",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
      },
      expect.any(Function),
    );
    expect(reconcileTerminalState).toHaveBeenNthCalledWith(
      2,
      {
        jobId: "completed",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
      },
      expect.any(Function),
    );
    // The loader re-read the CURRENT state inside the lock and produced the
    // full terminal state the service would write.
    expect(loaderResults).toEqual([
      {
        jobId: "failed",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
        status: "failed",
        error: "browser crashed",
      },
      {
        jobId: "completed",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
        status: "completed",
        artifactUrl: "/pdfs/completed.pdf",
        checksum: "sha",
      },
    ]);
    expect(queue.getJob).toHaveBeenCalledWith("failed-g1");
    expect(queue.getJob).toHaveBeenCalledWith("completed-g1");
  });

  it("scopes the terminal identity and the queue lookup to the payload generation", async () => {
    const loaderResults: unknown[] = [];
    const reconcileTerminalState = recordingReconcile(loaderResults);
    const queue = queueWith([
      job({
        jobId: "job-9",
        generation: 4,
        state: "failed",
        failedReason: "browser crashed",
      }),
    ]);
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).toHaveBeenCalledWith(
      {
        jobId: "job-9",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 4,
      },
      expect.any(Function),
    );
    expect(queue.getJob).toHaveBeenCalledWith("job-9-g4");
    expect(loaderResults).toEqual([
      {
        jobId: "job-9",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 4,
        status: "failed",
        error: "browser crashed",
      },
    ]);
  });

  it("reconciles a completed retry even when BullMQ retains its earlier failure reason", async () => {
    const loaderResults: unknown[] = [];
    const reconcileTerminalState = recordingReconcile(loaderResults);
    const queue = queueWith([
      job({
        jobId: "retry-completed",
        state: "completed",
        failedReason: "browser crashed on the first attempt",
        returnvalue: {
          artifactUrl: "/pdfs/retry-completed.pdf",
          checksum: "sha-retry",
        },
      }),
    ]);
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).toHaveBeenCalledWith(
      {
        jobId: "retry-completed",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
      },
      expect.any(Function),
    );
    expect(loaderResults).toEqual([
      {
        jobId: "retry-completed",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
        status: "completed",
        artifactUrl: "/pdfs/retry-completed.pdf",
        checksum: "sha-retry",
      },
    ]);
  });

  it("does not invent a completion when BullMQ has no artifact result", async () => {
    const loaderResults: unknown[] = [];
    const reconcileTerminalState = recordingReconcile(loaderResults);
    const queue = queueWith([job({ jobId: "no-result" })]);
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).toHaveBeenCalledWith(
      {
        jobId: "no-result",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
      },
      expect.any(Function),
    );
    // The loaded state stays a bare completed marker — adopting the canonical
    // artifact or declining the write is the service's call, not the loader's.
    expect(loaderResults).toEqual([
      {
        jobId: "no-result",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
        status: "completed",
      },
    ]);
  });

  it("skips a stale queue payload whose id or identity is mismatched", async () => {
    const reconcileTerminalState = vi.fn<ReconcileTerminalState>();
    const queue = {
      getJobs: vi
        .fn()
        .mockResolvedValue([
          { ...job({ jobId: "payload-id" }), id: "redis-id" },
        ]),
    } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).not.toHaveBeenCalled();
  });

  it("skips a terminal job whose queue id names another generation", async () => {
    // A retained entry from an older generation can never reconcile the row:
    // the payload's generation must rebuild the exact queue id.
    const reconcileTerminalState = vi.fn<ReconcileTerminalState>();
    const queue = queueWith([
      job({
        jobId: "job-1",
        generation: 2,
        queueId: "job-1-g1",
        state: "failed",
        failedReason: "old generation failure",
      }),
    ]);
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).not.toHaveBeenCalled();
  });

  it("skips a legacy terminal job whose payload carries no generation", async () => {
    // Pre-migration jobs used the bare jobId; they are invisible to the
    // generation protocol and the orphan scan reaps the stranded row instead.
    const reconcileTerminalState = vi.fn<ReconcileTerminalState>();
    const queue = queueWith([
      job({ jobId: "legacy-job", omitGeneration: true }),
    ]);
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).not.toHaveBeenCalled();
  });

  // The listing applies the same exact-match guard the processor enforces:
  // only a delivery whose own BullMQ id equals `${jobId}-g${generation}` can
  // supply the terminal identity — an id-less, bare, wrong-generation, or
  // foreign queue id is skipped, never reconciled.
  it.each([
    { queueId: "job-1-g1", reconciles: true, label: "exact generation id" },
    { queueId: undefined, reconciles: false, label: "no BullMQ id" },
    { queueId: "job-1", reconciles: false, label: "bare legacy id" },
    {
      queueId: "job-1-g9",
      reconciles: false,
      label: "another generation's id",
    },
    { queueId: "other-job", reconciles: false, label: "a foreign job's id" },
  ])(
    "reconciles a listed terminal job only when its queue id is the exact generation id: $label",
    async ({ queueId, reconciles }) => {
      const reconcileTerminalState = vi.fn<ReconcileTerminalState>();
      const queue = queueWith([
        job({
          jobId: "job-1",
          state: "failed",
          failedReason: "boom",
          queueId,
        }),
      ]);
      const scheduler = new PdfExportReconciliationScheduler(
        service({ reconcileTerminalState }),
        { get: () => queue },
      );

      await scheduler.runOnce();

      expect(reconcileTerminalState).toHaveBeenCalledTimes(reconciles ? 1 : 0);
    },
  );

  it("declines a retry that is no longer terminal when the lock is held", async () => {
    // The listing saw a terminal failure; by the time the row lock is held an
    // admin retry has requeued the job — the loader must resolve null so the
    // stale capture cannot terminalize the new attempt.
    const listed = job({
      jobId: "retry-active",
      state: "failed",
      failedReason: "browser crashed on the first attempt",
    });
    const current = new Map([
      ["retry-active-g1", job({ jobId: "retry-active", state: "active" })],
    ]);
    const loaderResults: unknown[] = [];
    const reconcileTerminalState = recordingReconcile(loaderResults);
    const queue = queueWith([listed], current);
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).toHaveBeenCalledTimes(1);
    expect(reconcileTerminalState).toHaveBeenCalledWith(
      {
        jobId: "retry-active",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
      },
      expect.any(Function),
    );
    expect(queue.getJob).toHaveBeenCalledWith("retry-active-g1");
    expect(loaderResults).toEqual([null]);
  });

  it("declines a job that disappeared between the listing and the row lock", async () => {
    const loaderResults: unknown[] = [];
    const reconcileTerminalState = recordingReconcile(loaderResults);
    const queue = queueWith(
      [job({ jobId: "gone", state: "failed", failedReason: "boom" })],
      new Map(),
    );
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(reconcileTerminalState).toHaveBeenCalledTimes(1);
    expect(loaderResults).toEqual([null]);
  });

  // The in-lock re-read applies the same exact-match guard to the job it
  // fetches under `${jobId}-g${generation}`: an id-less, bare,
  // wrong-generation, or foreign BullMQ id can never become the terminal
  // state — the loader must resolve null and the write is declined.
  it.each([
    { queueId: "job-1-g1", terminal: true, label: "exact generation id" },
    { queueId: undefined, terminal: false, label: "no BullMQ id" },
    { queueId: "job-1", terminal: false, label: "bare legacy id" },
    {
      queueId: "job-1-g9",
      terminal: false,
      label: "another generation's id",
    },
    { queueId: "other-job", terminal: false, label: "a foreign job's id" },
  ])(
    "declines the in-lock re-read unless its queue id is the exact generation id: $label",
    async ({ queueId, terminal }) => {
      const listed = job({
        jobId: "job-1",
        state: "failed",
        failedReason: "listed reason",
      });
      const reread = job({
        jobId: "job-1",
        state: "failed",
        failedReason: "reread reason",
        queueId,
      });
      const loaderResults: unknown[] = [];
      const reconcileTerminalState = recordingReconcile(loaderResults);
      const queue = {
        getJobs: vi.fn().mockResolvedValue([listed]),
        getJob: vi.fn().mockResolvedValue(reread),
      } as unknown as Queue;
      const scheduler = new PdfExportReconciliationScheduler(
        service({ reconcileTerminalState }),
        { get: () => queue },
      );

      await scheduler.runOnce();

      expect(reconcileTerminalState).toHaveBeenCalledTimes(1);
      expect(queue.getJob).toHaveBeenCalledWith("job-1-g1");
      expect(loaderResults).toEqual([
        terminal
          ? {
              jobId: "job-1",
              reportId: "report-1",
              requestedBy: "user-1",
              generation: 1,
              status: "failed",
              error: "reread reason",
            }
          : null,
      ]);
    },
  );

  it("isolates a state lookup failure and reconciles the valid sibling", async () => {
    const logError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const loaderResults: unknown[] = [];
    const reconcileTerminalState = recordingReconcile(loaderResults);
    const queue = queueWith([
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
    ]);
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await expect(scheduler.runOnce()).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(
      "pdf-export terminal reconciliation failed",
      { jobId: "state-unavailable", error: "Redis lookup failed" },
    );
    expect(reconcileTerminalState).toHaveBeenCalledTimes(2);
    expect(loaderResults).toEqual([
      {
        jobId: "completed-sibling",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
        status: "completed",
        artifactUrl: "/pdfs/completed-sibling.pdf",
        checksum: "sha-sibling",
      },
    ]);
  });

  it("re-reads the job after the terminal observation so a newer attempt's failedReason wins", async () => {
    // The first in-lock getJob still returns attempt A's snapshot while
    // attempt B has already failed underneath it — the Postgres row lock
    // does not serialize BullMQ transitions. After observing the terminal
    // state the loader must reread the job and persist the fresh metadata,
    // not the stale snapshot's failedReason.
    const staleRead = job({
      jobId: "job-1",
      state: "failed",
      failedReason: "attempt-A stale reason",
    });
    const freshRead = job({
      jobId: "job-1",
      state: "failed",
      failedReason: "attempt-B latest reason",
    });
    const loaderResults: unknown[] = [];
    const reconcileTerminalState = recordingReconcile(loaderResults);
    const queue = {
      getJobs: vi
        .fn()
        .mockResolvedValue([job({ jobId: "job-1", state: "failed" })]),
      getJob: vi
        .fn()
        .mockResolvedValueOnce(staleRead)
        .mockResolvedValue(freshRead),
    } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(queue.getJob).toHaveBeenCalledTimes(2);
    expect(loaderResults).toEqual([
      {
        jobId: "job-1",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
        status: "failed",
        error: "attempt-B latest reason",
      },
    ]);
  });

  it("re-reads the job after the terminal observation so a newer attempt's artifact wins", async () => {
    // Same transition-between-reads race on the completed path: the first
    // snapshot's returnvalue belongs to attempt A; the reread returns the
    // newer attempt B's artifact result.
    const staleRead = job({
      jobId: "job-1",
      state: "completed",
      returnvalue: { artifactUrl: "/pdfs/job-1.pdf", checksum: "sha-A" },
    });
    const freshRead = job({
      jobId: "job-1",
      state: "completed",
      returnvalue: { artifactUrl: "/pdfs/job-1.pdf", checksum: "sha-B" },
    });
    const loaderResults: unknown[] = [];
    const reconcileTerminalState = recordingReconcile(loaderResults);
    const queue = {
      getJobs: vi
        .fn()
        .mockResolvedValue([job({ jobId: "job-1", state: "completed" })]),
      getJob: vi
        .fn()
        .mockResolvedValueOnce(staleRead)
        .mockResolvedValue(freshRead),
    } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      service({ reconcileTerminalState }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    expect(queue.getJob).toHaveBeenCalledTimes(2);
    expect(loaderResults).toEqual([
      {
        jobId: "job-1",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
        status: "completed",
        artifactUrl: "/pdfs/job-1.pdf",
        checksum: "sha-B",
      },
    ]);
  });

  it("hands the orphan scan a probe for the generation-scoped queue job", async () => {
    let probe: OrphanQueueProbe | undefined;
    const scanOrphanedPendingExports = vi
      .fn<ScanOrphanedPendingExports>()
      .mockImplementation((hasQueueJob) => {
        probe = hasQueueJob;
        return Promise.resolve();
      });
    const queue = queueWith(
      [],
      new Map([["job-9-g4", job({ jobId: "job-9", generation: 4 })]]),
    );
    const scheduler = new PdfExportReconciliationScheduler(
      service({ scanOrphanedPendingExports }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    // One delegation per pass — the service owns the keyset paging; the
    // scheduler never buffers or iterates candidate rows itself.
    expect(scanOrphanedPendingExports).toHaveBeenCalledTimes(1);
    if (!probe) {
      throw new Error("the orphan scan did not receive the queue probe");
    }
    await expect(probe({ jobId: "job-9", generation: 4 })).resolves.toBe(true);
    expect(queue.getJob).toHaveBeenCalledWith("job-9-g4");
    // Confirmed absence answers false — quarantining the row is the service's
    // locked write, not the probe's.
    await expect(probe({ jobId: "absent", generation: 1 })).resolves.toBe(
      false,
    );
    expect(queue.getJob).toHaveBeenCalledWith("absent-g1");
  });

  it("propagates a probe Redis error to the service instead of answering absence", async () => {
    let probe: OrphanQueueProbe | undefined;
    const scanOrphanedPendingExports = vi
      .fn<ScanOrphanedPendingExports>()
      .mockImplementation((hasQueueJob) => {
        probe = hasQueueJob;
        return Promise.resolve();
      });
    const queue = {
      getJobs: vi.fn().mockResolvedValue([]),
      getJob: vi.fn().mockRejectedValue(new Error("Redis timeout")),
    } as unknown as Queue;
    const scheduler = new PdfExportReconciliationScheduler(
      service({ scanOrphanedPendingExports }),
      { get: () => queue },
    );

    await scheduler.runOnce();

    if (!probe) {
      throw new Error("the orphan scan did not receive the queue probe");
    }
    // An unknown queue outcome must reach the service's skip-and-log path —
    // the probe can never convert it into absence.
    await expect(probe({ jobId: "job-1", generation: 1 })).rejects.toThrow(
      "Redis timeout",
    );
  });

  it("surfaces an orphan scan failure through runOnce like the terminal pass", async () => {
    const scanOrphanedPendingExports = vi
      .fn<ScanOrphanedPendingExports>()
      .mockRejectedValue(new Error("scan store unavailable"));
    const queue = queueWith([]);
    const scheduler = new PdfExportReconciliationScheduler(
      service({ scanOrphanedPendingExports }),
      { get: () => queue },
    );

    await expect(scheduler.runOnce()).rejects.toThrow("scan store unavailable");
  });
});
