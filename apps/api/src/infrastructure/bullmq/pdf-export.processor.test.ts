import {
  AUTH_COOKIE_NAME,
  type PdfExportJob,
  pdfExportJobSchema,
} from "@customreport/shared";
import type { Job, Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import type {
  PdfExportJobRecord,
  PdfExportLockedJobWrites,
  PdfExportRepository,
  PdfRenderer,
} from "../../modules/pdf-export/index.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { NOOP_PDF_EXPORT_TELEMETRY } from "../../test-utils/pdf-export.js";
import { silenceStderr } from "../../test-utils/silence-logs";

// Mock factories use vi.fn() inline (no outer variable references) because
// vi.mock is hoisted before variable declarations.

vi.mock("@nestjs/common", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nestjs/common")>()),
  Injectable: () => (target: unknown) => target,
}));

// Mock bullmq Worker so no Redis connection is attempted
vi.mock("bullmq", () => ({
  Worker: class {
    static readonly instances: {
      handlers: Record<string, (...args: never[]) => void>;
    }[] = [];

    handlers: Record<string, (...args: never[]) => void> = {};

    constructor() {
      (
        this.constructor as typeof import("bullmq").Worker & {
          instances: {
            handlers: Record<string, (...args: never[]) => void>;
          }[];
        }
      ).instances.push(this);
    }

    on(event: string, handler: (...args: never[]) => void) {
      this.handlers[event] = handler;
    }

    close() {
      return Promise.resolve();
    }
  },
}));

// Mock the service (and its transitive @customreport/shared dependency)
vi.mock("../../modules/pdf-export/index.js", () => ({
  PDF_RENDERER: Symbol("PdfRenderer"),
  PdfExportService: class {
    markExportCompleted = vi.fn();
    markExportFailed = vi.fn();
    reconcileTerminalState = vi.fn();
    assertPdfExportJobIdentity = vi.fn();
    signPdfExportToken = vi.fn().mockReturnValue("fresh-jwt");
    buildAuthCookies = vi.fn().mockReturnValue([
      {
        name: AUTH_COOKIE_NAME,
        value: "fake-jwt",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  },
}));

import { Worker } from "bullmq";

import type { EnvConfig } from "../config/env.schema";
import {
  type PdfArtifactAttempt,
  type PdfArtifactStore,
  PdfExportProcessor as ProductionPdfExportProcessor,
} from "./pdf-export.processor.js";
import type { QueueRegistry } from "./queue-registry.js";

function createMockArtifactStore(checksum = "abc123hash") {
  const attempt: PdfArtifactAttempt = {
    tempPath: "artifact-test-temp/.job-1.attempt.pdf.tmp",
    canonicalPath: "artifact-test-temp/job-1.pdf",
  };
  return {
    createAttempt: vi.fn().mockResolvedValue(attempt),
    publishAndHash: vi.fn().mockResolvedValue(checksum),
    cleanupAttempt: vi.fn().mockResolvedValue(undefined),
  } satisfies PdfArtifactStore;
}

// The renderer is the HTTP-boundary port: the processor hands it the print
// URL, the job-scoped credential, and the trace id, then persists whatever
// validated bytes it returns.
function createMockRenderer(): PdfRenderer & {
  render: ReturnType<typeof vi.fn>;
} {
  return {
    render: vi.fn().mockResolvedValue(Buffer.from("pdf-bytes")),
  };
}

class PdfExportProcessor extends ProductionPdfExportProcessor {
  private readonly artifactStore: PdfArtifactStore;

  constructor(
    service: ConstructorParameters<typeof ProductionPdfExportProcessor>[0],
    renderer: ConstructorParameters<typeof ProductionPdfExportProcessor>[1],
    env: EnvConfig,
    logger: AppLogger = createNullLogger(),
    artifactStore: PdfArtifactStore = createMockArtifactStore(),
    queues: Pick<QueueRegistry, "get"> = queuesWith(undefined).registry,
  ) {
    super(service, renderer, env, logger, null, queues);
    this.artifactStore = artifactStore;
  }

  protected override createArtifactStore(): PdfArtifactStore {
    return this.artifactStore;
  }
}

// Minimal stub for the constructor plus the keys processJob reads directly
// (PDF_OUTPUT_DIR feeds resolve() on the capture path — a missing value is a
// crash, not a fallback, by design).
const STUB_ENV = {
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  PDF_BASE_URL: "http://localhost:3000",
  PDF_OUTPUT_DIR: "./storage/pdfs-test",
} as EnvConfig;

function createMockPdfExportService() {
  return {
    markExportCompleted: vi.fn().mockResolvedValue(undefined),
    markExportFailed: vi.fn().mockResolvedValue(undefined),
    reconcileTerminalState: vi.fn().mockResolvedValue(true),
    assertPdfExportJobIdentity: vi.fn().mockResolvedValue(undefined),
    // The processor mints the short-lived render JWT at execution time and
    // hands the resulting job-scoped cookie to the renderer.
    signPdfExportToken: vi.fn().mockReturnValue("fresh-jwt"),
    buildAuthCookies: vi.fn().mockReturnValue([
      {
        name: AUTH_COOKIE_NAME,
        value: "fake-jwt",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]),
  };
}

interface PdfExportJobData {
  reportId: string;
  jobId: string;
  requestedBy: string;
}

function createMockJob(
  data: PdfExportJobData,
  attemptsMade = 0,
  attempts = 1,
  options: {
    state?: Awaited<ReturnType<Job["getState"]>>;
    failedReason?: string;
    queueJobId?: string;
  } = {},
): Job<PdfExportJobData> {
  return {
    id: options.queueJobId ?? data.jobId,
    data,
    attemptsMade,
    opts: { attempts },
    failedReason: options.failedReason,
    getState: vi.fn().mockResolvedValue(options.state ?? "failed"),
  } as unknown as Job<PdfExportJobData>;
}

// The queue handle the delayed-failure loader re-reads inside the export row
// lock: `current` is the job a fresh getJob returns — which may be a newer
// attempt than the one the failed event was captured from.
function queuesWith(current: Job<unknown> | undefined) {
  const queue = {
    getJob: vi.fn().mockResolvedValue(current),
  } as unknown as Queue;
  const registry = {
    get: () => queue,
  } satisfies Pick<QueueRegistry, "get">;
  return { registry, queue };
}

// Test seam — `processJob` is `protected`; cast through this interface so
// tests can invoke it directly without `as any`.
interface ProcessorTestSeam {
  processJob(job: Job<PdfExportJobData>): Promise<void>;
}

describe("PdfExportProcessor.processJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates capture to the renderer with the print URL, job-scoped cookies, and job-id trace", async () => {
    const renderer = createMockRenderer();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
      renderer,
      STUB_ENV,
    );
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    // Print route lives at /print/[id] (top-level, outside the (app) route
    // group) so the print viewport doesn't inherit NavBar/DEV switcher chrome.
    expect(renderer.render).toHaveBeenCalledExactlyOnceWith({
      url: "http://localhost:3000/print/report-1?jobId=job-1",
      cookies: [
        {
          name: AUTH_COOKIE_NAME,
          value: "fake-jwt",
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ],
      traceId: "job-1",
    });
  });

  it("fails closed when queue identity does not match the persisted job", async () => {
    const renderer = createMockRenderer();
    const mockService = createMockPdfExportService();
    mockService.assertPdfExportJobIdentity.mockRejectedValueOnce(
      new Error("PDF export job job-1 was not found."),
    );
    const processor = new PdfExportProcessor(
      mockService as never,
      renderer,
      STUB_ENV,
    );
    const job = createMockJob({
      reportId: "wrong-report",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow("PDF export job job-1 was not found.");
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("mints a fresh render token at execution time and never reads one from job data", async () => {
    // The durable payload carries only identifiers; the worker signs a fresh
    // short-lived token from them and feeds exactly that token into the
    // credential cookie the renderer scopes to the print origin.
    const renderer = createMockRenderer();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
      renderer,
      STUB_ENV,
    );
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockService.signPdfExportToken).toHaveBeenCalledExactlyOnceWith(
      "report-1",
      "job-1",
      "user-1",
    );
    expect(mockService.buildAuthCookies).toHaveBeenCalledWith("fresh-jwt");
  });

  it("marks export completed with correct args", async () => {
    const renderer = createMockRenderer();
    const mockService = createMockPdfExportService();
    const artifactStore = createMockArtifactStore();
    const processor = new PdfExportProcessor(
      mockService as never,
      renderer,
      STUB_ENV,
      createNullLogger(),
      artifactStore,
    );
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockService.markExportCompleted).toHaveBeenCalledWith(
      "job-1",
      "/pdfs/job-1.pdf",
      "abc123hash",
    );
    expect(artifactStore.createAttempt).toHaveBeenCalledWith(
      expect.stringMatching(/storage\/pdfs-test$/),
      "job-1",
      Buffer.from("pdf-bytes"),
    );
    expect(artifactStore.publishAndHash).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalPath: "artifact-test-temp/job-1.pdf",
      }),
    );
    expect(artifactStore.cleanupAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        tempPath: "artifact-test-temp/.job-1.attempt.pdf.tmp",
      }),
    );
  });

  it("emits a per-step duration log for the renderer call", async () => {
    const renderer = createMockRenderer();
    const infoSpy = vi.fn<AppLogger["info"]>();
    const logger: AppLogger = {
      debug: vi.fn(),
      info: infoSpy,
      warn: vi.fn(),
      error: vi.fn(),
      child: () => logger,
    };
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
      renderer,
      STUB_ENV,
      logger,
    );
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    const renderContext = expectDefined(
      infoSpy.mock.calls.find(
        ([message, context]) =>
          message === "pdf-export step complete" &&
          context?.step === "renderer.render",
      )?.[1],
    );
    expect(renderContext).toMatchObject({
      jobId: "job-1",
      step: "renderer.render",
    });
    expect(typeof renderContext.durationMs).toBe("number");
  });

  it("propagates a renderer failure without persisting an artifact", async () => {
    silenceStderr();
    // A spinner/error/never-ready page surfaces as a renderer rejection — the
    // worker stores no artifact and lets the job failure reconcile normally.
    const renderer = createMockRenderer();
    renderer.render.mockRejectedValue(new Error("renderer answered 503"));
    const mockService = createMockPdfExportService();
    const artifactStore = createMockArtifactStore();
    const processor = new PdfExportProcessor(
      mockService as never,
      renderer,
      STUB_ENV,
      createNullLogger(),
      artifactStore,
    );
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow("renderer answered 503");

    expect(artifactStore.createAttempt).not.toHaveBeenCalled();
    expect(mockService.markExportCompleted).not.toHaveBeenCalled();
  });

  it("propagates an unrecoverable renderer rejection unchanged", async () => {
    silenceStderr();
    // UnrecoverableError (a direct 403 at the renderer boundary) must reach
    // BullMQ unwrapped so the attempt is terminal without consuming retries.
    class UnrecoverableError extends Error {}
    const renderer = createMockRenderer();
    renderer.render.mockRejectedValue(
      new UnrecoverableError("renderer answered 403"),
    );
    const mockService = createMockPdfExportService();
    const artifactStore = createMockArtifactStore();
    const processor = new PdfExportProcessor(
      mockService as never,
      renderer,
      STUB_ENV,
      createNullLogger(),
      artifactStore,
    );
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow(UnrecoverableError);

    expect(artifactStore.createAttempt).not.toHaveBeenCalled();
    expect(mockService.markExportCompleted).not.toHaveBeenCalled();
  });

  it("cleans up the attempt when completion persistence fails", async () => {
    const renderer = createMockRenderer();
    const mockService = createMockPdfExportService();
    const artifactStore = createMockArtifactStore();
    mockService.markExportCompleted.mockRejectedValue(
      new Error("database unavailable"),
    );
    const processor = new PdfExportProcessor(
      mockService as never,
      renderer,
      STUB_ENV,
      createNullLogger(),
      artifactStore,
    );
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow("database unavailable");

    expect(artifactStore.createAttempt).toHaveBeenCalledOnce();
    expect(artifactStore.cleanupAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        tempPath: "artifact-test-temp/.job-1.attempt.pdf.tmp",
      }),
    );
  });
});

describe("PdfExportProcessor.onModuleInit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      Worker as unknown as {
        instances: {
          handlers: Record<string, (...args: never[]) => void>;
        }[];
      }
    ).instances = [];
  });

  it("marks the DB export job failed only when the queue re-read is terminal", async () => {
    const jobData = {
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    };
    // Every failed event reconciles through the loader: the re-read inside
    // the row lock decides terminality. An intermediate failure re-reads the
    // job as re-queued ("waiting"), so no terminal write happens.
    const current = createMockJob(jobData, 3, 3, { state: "waiting" });
    const { registry, queue } = queuesWith(current);
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
      createMockRenderer(),
      STUB_ENV,
      createNullLogger(),
      createMockArtifactStore(),
      registry,
    );

    processor.onModuleInit();

    const instances = (
      Worker as unknown as {
        instances: {
          handlers: Record<string, (...args: never[]) => void>;
        }[];
      }
    ).instances;
    const failedHandler = instances.at(-1)?.handlers.failed;
    expect(failedHandler).toBeTypeOf("function");

    // BullMQ increments attemptsMade before emitting `failed`, so for
    // attempts=3 the penultimate failure reports attemptsMade=2 — a third
    // attempt is still queued, and the re-read observes "waiting".
    failedHandler?.(
      createMockJob(jobData, 2, 3) as never,
      new Error("renderer missing") as never,
    );

    await vi.waitFor(() => {
      expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
        { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
        expect.any(Function),
      );
    });
    const intermediateLoad = expectDefined(
      mockService.reconcileTerminalState.mock.calls[0]?.[1],
    ) as () => Promise<unknown>;
    await expect(intermediateLoad()).resolves.toBeNull();
    expect(mockService.markExportCompleted).not.toHaveBeenCalled();

    // The true terminal failure re-reads the job as "failed", carrying the
    // current attempt's own failedReason.
    current.getState = vi.fn().mockResolvedValue("failed");
    current.failedReason = "renderer missing";
    failedHandler?.(
      createMockJob(jobData, 3, 3) as never,
      new Error("renderer missing") as never,
    );

    await vi.waitFor(() => {
      expect(mockService.reconcileTerminalState).toHaveBeenCalledTimes(2);
    });
    const loadCurrent = expectDefined(
      mockService.reconcileTerminalState.mock.calls[1]?.[1],
    ) as () => Promise<unknown>;
    await expect(loadCurrent()).resolves.toEqual({
      jobId: "job-1",
      reportId: "report-1",
      requestedBy: "user-1",
      status: "failed",
      error: "renderer missing",
    });
    expect(queue.getJob).toHaveBeenCalledWith("job-1");
  });

  it("terminalizes an unrecoverable failure with attempts remaining", async () => {
    const jobData = {
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    };
    // A BullMQ UnrecoverableError marks the job failed while retry attempts
    // are still left: the loader must not gate on attemptsMade — the queue
    // re-read showing "failed" is what makes the event terminal.
    const current = createMockJob(jobData, 1, 3, {
      state: "failed",
      failedReason: "renderer answered 403",
    });
    const { registry, queue } = queuesWith(current);
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
      createMockRenderer(),
      STUB_ENV,
      createNullLogger(),
      createMockArtifactStore(),
      registry,
    );
    processor.onModuleInit();
    const instances = (
      Worker as unknown as {
        instances: { handlers: Record<string, (...args: never[]) => void> }[];
      }
    ).instances;
    const failedHandler = instances.at(-1)?.handlers.failed;

    failedHandler?.(
      createMockJob(jobData, 1, 3) as never,
      new Error("renderer answered 403") as never,
    );

    await vi.waitFor(() => {
      expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
        { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
        expect.any(Function),
      );
    });
    const loadCurrent = expectDefined(
      mockService.reconcileTerminalState.mock.calls[0]?.[1],
    ) as () => Promise<unknown>;
    await expect(loadCurrent()).resolves.toEqual({
      jobId: "job-1",
      reportId: "report-1",
      requestedBy: "user-1",
      status: "failed",
      error: "renderer answered 403",
    });
    expect(queue.getJob).toHaveBeenCalledWith("job-1");
  });

  it("cannot terminalize a revived attempt with a failure captured before the row lock", async () => {
    const jobData = {
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    };
    // The failed event fired on the terminal attempt, but an admin retry
    // requeued the job before the durable row lock was acquired — the loader
    // must observe the current "waiting", not the captured "failed".
    const { registry, queue } = queuesWith(
      createMockJob(jobData, 4, 4, { state: "waiting" }),
    );
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
      createMockRenderer(),
      STUB_ENV,
      createNullLogger(),
      createMockArtifactStore(),
      registry,
    );
    processor.onModuleInit();
    const instances = (
      Worker as unknown as {
        instances: { handlers: Record<string, (...args: never[]) => void> }[];
      }
    ).instances;
    const failedHandler = instances.at(-1)?.handlers.failed;

    failedHandler?.(
      createMockJob(jobData, 3, 3, {
        state: "failed",
        failedReason: "attempt-A crashed",
      }) as never,
      new Error("attempt-A crashed") as never,
    );

    await vi.waitFor(() => {
      expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
        { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
        expect.any(Function),
      );
    });
    const loadCurrent = expectDefined(
      mockService.reconcileTerminalState.mock.calls[0]?.[1],
    ) as () => Promise<unknown>;
    await expect(loadCurrent()).resolves.toBeNull();
    expect(queue.getJob).toHaveBeenCalledWith("job-1");
  });

  it("records the current attempt's failedReason, not a stale event's, when a retried job failed again", async () => {
    const jobData = {
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    };
    // Attempt A's failed event is still in flight; an admin retry requeued
    // the job and attempt B already failed. Inside the row lock the durable
    // row must adopt B's payload identity and failedReason — never A's
    // captured error, which the pending-only CAS would otherwise freeze.
    const { registry, queue } = queuesWith(
      createMockJob(jobData, 4, 4, {
        state: "failed",
        failedReason: "attempt-B exploded",
      }),
    );
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
      createMockRenderer(),
      STUB_ENV,
      createNullLogger(),
      createMockArtifactStore(),
      registry,
    );
    processor.onModuleInit();
    const instances = (
      Worker as unknown as {
        instances: { handlers: Record<string, (...args: never[]) => void> }[];
      }
    ).instances;
    const failedHandler = instances.at(-1)?.handlers.failed;

    failedHandler?.(
      createMockJob(jobData, 3, 3, {
        state: "failed",
        failedReason: "attempt-A crashed",
      }) as never,
      new Error("attempt-A crashed") as never,
    );

    await vi.waitFor(() => {
      expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
        { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
        expect.any(Function),
      );
    });
    const loadCurrent = expectDefined(
      mockService.reconcileTerminalState.mock.calls[0]?.[1],
    ) as () => Promise<unknown>;
    await expect(loadCurrent()).resolves.toEqual({
      jobId: "job-1",
      reportId: "report-1",
      requestedBy: "user-1",
      status: "failed",
      error: "attempt-B exploded",
    });
    expect(queue.getJob).toHaveBeenCalledWith("job-1");
  });

  it("hands the service the current job's payload, so a rebound payload is declined", async () => {
    const staleJobData = {
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    };
    // The job now bound to this id carries a different payload — rebound or
    // tampered. The loader surfaces the CURRENT payload instead of the stale
    // event's, so the service's state-vs-identity check declines the write.
    const { registry, queue } = queuesWith(
      createMockJob(
        { reportId: "other-report", jobId: "job-1", requestedBy: "user-1" },
        4,
        4,
        { state: "failed", failedReason: "attempt-B exploded" },
      ),
    );
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
      createMockRenderer(),
      STUB_ENV,
      createNullLogger(),
      createMockArtifactStore(),
      registry,
    );
    processor.onModuleInit();
    const instances = (
      Worker as unknown as {
        instances: { handlers: Record<string, (...args: never[]) => void> }[];
      }
    ).instances;
    const failedHandler = instances.at(-1)?.handlers.failed;

    failedHandler?.(
      createMockJob(staleJobData, 3, 3) as never,
      new Error("attempt-A crashed") as never,
    );

    await vi.waitFor(() => {
      expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
        { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
        expect.any(Function),
      );
    });
    const loadCurrent = expectDefined(
      mockService.reconcileTerminalState.mock.calls[0]?.[1],
    ) as () => Promise<unknown>;
    await expect(loadCurrent()).resolves.toEqual({
      jobId: "job-1",
      reportId: "other-report",
      requestedBy: "user-1",
      status: "failed",
      error: "attempt-B exploded",
    });
    expect(queue.getJob).toHaveBeenCalledWith("job-1");
  });

  it("rejects a failed event whose BullMQ id does not match its payload", () => {
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
      createMockRenderer(),
      STUB_ENV,
    );
    processor.onModuleInit();
    const instances = (
      Worker as unknown as {
        instances: { handlers: Record<string, (...args: never[]) => void> }[];
      }
    ).instances;
    const failedHandler = instances.at(-1)?.handlers.failed;
    const jobData = {
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    };

    failedHandler?.(
      createMockJob(jobData, 3, 3, { queueJobId: "other-job" }) as never,
      new Error("bad") as never,
    );

    expect(mockService.reconcileTerminalState).not.toHaveBeenCalled();
  });

  it("uses the failedReason re-read after the terminal observation, not the earlier snapshot", async () => {
    const jobData = {
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    };
    // The Postgres row lock does not serialize BullMQ transitions: the
    // snapshot the first in-lock getJob returns can still carry attempt A's
    // failedReason while attempt B has already failed underneath it. After
    // observing the terminal state the loader must reread the job and use
    // the fresh metadata — otherwise the durable row freezes A's stale
    // reason and the pending-only CAS keeps the wrong error forever.
    const staleRead = createMockJob(jobData, 4, 4, {
      state: "failed",
      failedReason: "attempt-A stale reason",
    });
    const freshRead = createMockJob(jobData, 4, 4, {
      state: "failed",
      failedReason: "attempt-B latest reason",
    });
    const queue = {
      getJob: vi
        .fn()
        .mockResolvedValueOnce(staleRead)
        .mockResolvedValue(freshRead),
    } as unknown as Queue;
    const registry = {
      get: () => queue,
    } satisfies Pick<QueueRegistry, "get">;
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
      createMockRenderer(),
      STUB_ENV,
      createNullLogger(),
      createMockArtifactStore(),
      registry,
    );
    processor.onModuleInit();
    const instances = (
      Worker as unknown as {
        instances: { handlers: Record<string, (...args: never[]) => void> }[];
      }
    ).instances;
    const failedHandler = instances.at(-1)?.handlers.failed;

    failedHandler?.(
      createMockJob(jobData, 3, 3, {
        state: "failed",
        failedReason: "attempt-A stale reason",
      }) as never,
      new Error("attempt-A stale reason") as never,
    );

    await vi.waitFor(() => {
      expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
        { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
        expect.any(Function),
      );
    });
    const loadCurrent = expectDefined(
      mockService.reconcileTerminalState.mock.calls[0]?.[1],
    ) as () => Promise<unknown>;
    await expect(loadCurrent()).resolves.toEqual({
      jobId: "job-1",
      reportId: "report-1",
      requestedBy: "user-1",
      status: "failed",
      error: "attempt-B latest reason",
    });
    expect(queue.getJob).toHaveBeenCalledTimes(2);
  });

  it("performs no scoped write when the freshly re-read payload mismatches the durable identity", async () => {
    // Composed regression: the real PdfExportService.reconcileTerminalState
    // runs inside the fake repository's locked-writes scope. The failed event
    // claims identity A; the first queue snapshot still carries A, but the
    // reread after the terminal observation returns rebound payload B — so
    // the durable row must see no write at all.
    const { PdfExportService: RealPdfExportService } = await vi.importActual<
      typeof import("../../modules/pdf-export/pdf-export.service.js")
    >("../../modules/pdf-export/pdf-export.service.js");

    const identityA = {
      jobId: "759b2767-0f86-41e2-b025-49730ca010e4",
      reportId: "659b2767-0f86-41e2-b025-49730ca010e4",
      requestedBy: "00000000-0000-4000-8000-00000000aaaa",
    };
    const durableJob: PdfExportJobRecord = {
      ...pdfExportJobSchema.parse({
        jobId: identityA.jobId,
        reportId: identityA.reportId,
        status: "queued",
        requestedAt: new Date("2026-06-09T00:00:00Z"),
        completedAt: null,
        checksum: null,
        templateVersion: "phase-2-pdf-v1",
        artifactUrl: null,
      }),
      requestedBy: identityA.requestedBy,
    };
    const writes = {
      markFailed: vi
        .fn<(error: string) => Promise<void>>()
        .mockResolvedValue(undefined),
      markCompleted: vi
        .fn<(artifactUrl: string, checksum: string) => Promise<PdfExportJob>>()
        .mockRejectedValue(new Error("not used in this test")),
      reviveFailed: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    } satisfies PdfExportLockedJobWrites;
    let settled = false;
    const repository: PdfExportRepository = {
      getPublishedReportForExport: () => Promise.resolve(null),
      createExportJob: () => Promise.reject(new Error("not used in this test")),
      getPublishedReportForJob: () => Promise.resolve(null),
      getExportJob: () => Promise.resolve(durableJob),
      saveExportJob: () => Promise.reject(new Error("not used in this test")),
      markExportFailed: () => Promise.resolve(),
      runLockedExportJob: (_jobId, run) =>
        run(durableJob, writes).finally(() => {
          settled = true;
        }),
    };
    const realService = new RealPdfExportService(
      repository,
      createNullLogger(),
      { enqueue: () => Promise.resolve() },
      NOOP_PDF_EXPORT_TELEMETRY,
      {
        PDF_BASE_URL: "http://localhost:3000",
        PDF_EXPORT_JWT_SECRET: "test-pdf-export-secret-at-least-32-chars",
      },
    );

    const staleRead = createMockJob(identityA, 4, 4, {
      state: "failed",
      failedReason: "attempt-A stale reason",
    });
    const freshRead = createMockJob(
      {
        jobId: identityA.jobId,
        reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requestedBy: "00000000-0000-4000-8000-00000000bbbb",
      },
      4,
      4,
      { state: "failed", failedReason: "rebound payload failure" },
    );
    const queue = {
      getJob: vi
        .fn()
        .mockResolvedValueOnce(staleRead)
        .mockResolvedValue(freshRead),
    } as unknown as Queue;
    const processor = new PdfExportProcessor(
      realService,
      createMockRenderer(),
      STUB_ENV,
      createNullLogger(),
      createMockArtifactStore(),
      { get: () => queue },
    );
    processor.onModuleInit();
    const instances = (
      Worker as unknown as {
        instances: { handlers: Record<string, (...args: never[]) => void> }[];
      }
    ).instances;
    const failedHandler = instances.at(-1)?.handlers.failed;

    failedHandler?.(
      createMockJob(identityA, 3, 3) as never,
      new Error("attempt-A crashed") as never,
    );

    await vi.waitFor(() => {
      expect(settled).toBe(true);
    });
    expect(writes.markFailed).not.toHaveBeenCalled();
    expect(writes.markCompleted).not.toHaveBeenCalled();
    expect(writes.reviveFailed).not.toHaveBeenCalled();
  });
});
