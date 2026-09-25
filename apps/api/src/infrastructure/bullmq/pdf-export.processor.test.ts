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
        secure: false,
      },
    ]);
  },
}));

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { Worker } from "bullmq";
import { chromium } from "playwright";

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

class PdfExportProcessor extends ProductionPdfExportProcessor {
  private readonly artifactStore: PdfArtifactStore;

  constructor(
    service: ConstructorParameters<typeof ProductionPdfExportProcessor>[0],
    env: EnvConfig,
    logger: AppLogger = createNullLogger(),
    artifactStore: PdfArtifactStore = createMockArtifactStore(),
    queues: Pick<QueueRegistry, "get"> = queuesWith(undefined).registry,
  ) {
    super(service, env, logger, null, queues);
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
    // passes it to buildAuthCookies before page.goto.
    signPdfExportToken: vi.fn().mockReturnValue("fresh-jwt"),
    buildAuthCookies: vi.fn().mockReturnValue([
      {
        name: AUTH_COOKIE_NAME,
        value: "fake-jwt",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
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

function setupMocks() {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from("pdf-bytes")),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    // Readiness gate: default to the "ready" marker so the happy path proceeds.
    waitForSelector: vi.fn().mockResolvedValue({
      getAttribute: vi.fn().mockResolvedValue("ready"),
    }),
  };

  // The processor creates a context first then a page so it can addCookies
  // before navigation. Mocks must mirror that shape.
  const mockContext = {
    addCookies: vi.fn().mockResolvedValue(undefined),
    newPage: vi.fn().mockResolvedValue(mockPage),
  };

  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };

  vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as never);

  return { mockPage, mockBrowser, mockContext };
}

describe("PdfExportProcessor.processJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("launches Chromium with headless: true", async () => {
    setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
  });

  it("fails closed when queue identity does not match the persisted job", async () => {
    setupMocks();
    const mockService = createMockPdfExportService();
    mockService.assertPdfExportJobIdentity.mockRejectedValueOnce(
      new Error("PDF export job job-1 was not found."),
    );
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
    const job = createMockJob({
      reportId: "wrong-report",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow("PDF export job job-1 was not found.");
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("mints a fresh render token at execution time and never reads one from job data", async () => {
    // The durable payload carries only identifiers; the worker signs a fresh
    // short-lived token from them and feeds exactly that token into the cookie.
    setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
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

  it("navigates to correct report URL", async () => {
    const { mockPage } = setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    // Print route lives at /print/[id] (top-level, outside the (app) route
    // group) so the print viewport doesn't inherit NavBar/DEV switcher chrome.
    expect(mockPage.goto).toHaveBeenCalledWith(
      "http://localhost:3000/print/report-1?jobId=job-1",
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
  });

  it("generates PDF with A4 format and printBackground: true", async () => {
    const { mockPage } = setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockPage.pdf).toHaveBeenCalledWith({
      format: "A4",
      printBackground: true,
    });
  });

  it("marks export completed with correct args", async () => {
    setupMocks();
    const mockService = createMockPdfExportService();
    const artifactStore = createMockArtifactStore();
    const processor = new PdfExportProcessor(
      mockService as never,
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

  it("emits per-step duration logs for navigation, fonts, and capture", async () => {
    setupMocks();
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
      STUB_ENV,
      logger,
    );
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    const gotoContext = expectDefined(
      infoSpy.mock.calls.find(
        ([message, context]) =>
          message === "pdf-export step complete" &&
          context?.step === "page.goto",
      )?.[1],
    );
    expect(gotoContext).toMatchObject({
      jobId: "job-1",
      step: "page.goto",
    });
    expect(typeof gotoContext.durationMs).toBe("number");
    expect(infoSpy).toHaveBeenCalledWith(
      "pdf-export step complete",
      expect.objectContaining({ step: "wait.fonts" }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "pdf-export step complete",
      expect.objectContaining({ step: "page.pdf" }),
    );
  });

  it("captures only after the print page reaches the ready marker", async () => {
    const { mockPage } = setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockPage.waitForSelector).toHaveBeenCalledWith(
      '[data-print-state="ready"], [data-print-state="error"]',
      { state: "attached", timeout: 30_000 },
    );
    expect(mockPage.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      { timeout: 30_000 },
    );
  });

  it("skips capture when web fonts do not settle before the timeout", async () => {
    const { mockPage } = setupMocks();
    mockPage.waitForFunction.mockRejectedValue(new Error("font timeout"));
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow("font timeout");

    expect(mockPage.pdf).not.toHaveBeenCalled();
    expect(mockService.markExportCompleted).not.toHaveBeenCalled();
  });

  it("does not wait for network idle when an unrelated connection remains open", async () => {
    const { mockPage } = setupMocks();
    const unrelatedConnection = new Promise<never>(() => undefined);
    mockPage.goto.mockImplementation(
      async (_url: unknown, options: unknown) => {
        const navigation = options as { waitUntil?: string };
        if (navigation.waitUntil === "networkidle") await unrelatedConnection;
      },
    );
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockService.markExportCompleted).toHaveBeenCalledOnce();
  });

  it("throws and skips capture when the print page settles into the error state", async () => {
    silenceStderr();
    const { mockPage } = setupMocks();
    mockPage.waitForSelector.mockResolvedValue({
      getAttribute: vi.fn().mockResolvedValue("error"),
    });
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow(/ready state/i);

    expect(mockPage.pdf).not.toHaveBeenCalled();
    expect(mockService.markExportCompleted).not.toHaveBeenCalled();
  });

  it("cleans up the attempt when completion persistence fails", async () => {
    const { mockBrowser } = setupMocks();
    const mockService = createMockPdfExportService();
    const artifactStore = createMockArtifactStore();
    mockService.markExportCompleted.mockRejectedValue(
      new Error("database unavailable"),
    );
    const processor = new PdfExportProcessor(
      mockService as never,
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
    expect(mockBrowser.close).toHaveBeenCalledOnce();
  });

  it("closes browser in finally block even if page.goto throws", async () => {
    silenceStderr();
    const { mockPage, mockBrowser } = setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    });

    mockPage.goto.mockRejectedValue(new Error("navigation failed"));

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow("navigation failed");

    expect(mockBrowser.close).toHaveBeenCalledOnce();
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

  it("marks the DB export job failed only on the terminal attempt", async () => {
    const jobData = {
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
    };
    // What a fresh getJob returns when the loader runs inside the row lock:
    // the job still failed, carrying the current attempt's own failedReason.
    const { registry, queue } = queuesWith(
      createMockJob(jobData, 3, 3, {
        state: "failed",
        failedReason: "browser missing",
      }),
    );
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(
      mockService as never,
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
    // attempt is still queued.
    failedHandler?.(
      createMockJob(jobData, 2, 3) as never,
      new Error("browser missing") as never,
    );

    expect(mockService.reconcileTerminalState).not.toHaveBeenCalled();

    // The true terminal failure reports attemptsMade=3 (== attempts).
    failedHandler?.(
      createMockJob(jobData, 3, 3) as never,
      new Error("browser missing") as never,
    );

    expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
      { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
      expect.any(Function),
    );
    // The loader re-reads the current queue job inside the row lock: still
    // failed, so its payload identity and failedReason become the terminal
    // state the service would write.
    const loadCurrent = expectDefined(
      mockService.reconcileTerminalState.mock.calls[0]?.[1],
    ) as () => Promise<unknown>;
    await expect(loadCurrent()).resolves.toEqual({
      jobId: "job-1",
      reportId: "report-1",
      requestedBy: "user-1",
      status: "failed",
      error: "browser missing",
    });
    expect(queue.getJob).toHaveBeenCalledWith("job-1");
    expect(mockService.markExportCompleted).not.toHaveBeenCalled();
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

    expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
      { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
      expect.any(Function),
    );
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

    expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
      { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
      expect.any(Function),
    );
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

    expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
      { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
      expect.any(Function),
    );
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
    const processor = new PdfExportProcessor(mockService as never, STUB_ENV);
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

    expect(mockService.reconcileTerminalState).toHaveBeenCalledWith(
      { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
      expect.any(Function),
    );
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
