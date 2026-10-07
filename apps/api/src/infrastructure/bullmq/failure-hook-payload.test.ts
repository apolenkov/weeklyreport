import * as Sentry from "@sentry/nestjs";
import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { type AppLogger, createNullLogger } from "../../lib/logger.js";

// Keep the real module surface so adding another Nest import cannot turn it
// into undefined; only the decorator needs to be inert for this unit.
vi.mock("@nestjs/common", async (importActual) => ({
  ...(await importActual<typeof import("@nestjs/common")>()),
  Injectable: () => (target: unknown) => target,
}));

vi.mock("@sentry/nestjs", () => ({ captureException: vi.fn() }));

// Mock bullmq Worker so no Redis connection is attempted. The failed-event
// handler is captured per instance so tests can drive the real wiring.
vi.mock("bullmq", () => ({
  UnrecoverableError: class UnrecoverableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnrecoverableError";
    }
  },
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

// Mock services (and their transitive dependencies) so each processor unit
// stays isolated from Prisma and Nest DI.
vi.mock("../../modules/reminders/index.js", () => ({
  parseReminderQueueJobData: (data: unknown) => {
    if (
      typeof data !== "object" ||
      data === null ||
      !("contractVersion" in data) ||
      data.contractVersion !== 1 ||
      !("kind" in data) ||
      (data.kind !== "deadline" && data.kind !== "escalation")
    ) {
      throw new Error("Unsupported email reminder payload kind.");
    }
    return data;
  },
  RemindersService: class {
    markReminderSent = vi.fn();
  },
}));

vi.mock("../../modules/admin/index.js", () => ({
  SnapshotAdminService: class {
    getSettings = vi.fn();
  },
}));

vi.mock("../../modules/email/index.js", () => ({
  renderEmail: vi.fn(),
}));

vi.mock("../../modules/pdf-export/index.js", () => ({
  PDF_RENDERER: Symbol("PdfRenderer"),
  PdfExportService: class {
    reconcileTerminalState = vi.fn();
  },
}));

import { Worker } from "bullmq";

import type { EnvConfig } from "../config/env.schema";
import {
  type EmailReminderJobData,
  EmailReminderProcessor,
} from "./email-reminder.processor.js";
import { PdfExportProcessor } from "./pdf-export.processor.js";

const STUB_ENV = {
  REDIS_DB: 15,
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  PDF_BASE_URL: "http://localhost:3000",
  PDF_OUTPUT_DIR: "./storage/pdfs-test",
} as EnvConfig;

type SpyLogger = AppLogger & {
  readonly warn: Mock<
    (message: string, context?: Record<string, unknown>) => void
  >;
  readonly error: Mock<
    (message: string, context?: Record<string, unknown>) => void
  >;
};

function makeSpyLogger(): SpyLogger {
  const logger: SpyLogger = {
    debug:
      vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    info: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    warn: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    error:
      vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    child: () => logger,
  };
  return logger;
}

// Redis JSON can deliver `null` or a primitive where Job<T> claims an object;
// the cast mirrors that untrusted boundary without `as any`.
function jobWithData<TData>(data: unknown): Job<TData> {
  return {
    data,
    attemptsMade: 1,
    opts: { attempts: 3 },
  } as unknown as Job<TData>;
}

function workerInstances(): {
  handlers: Record<string, (...args: never[]) => void>;
}[] {
  return (
    Worker as unknown as {
      instances: { handlers: Record<string, (...args: never[]) => void> }[];
    }
  ).instances;
}

const flushAsync = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe("EmailReminderProcessor.onJobFailed malformed payloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeProcessor(logger: AppLogger): EmailReminderProcessor {
    return new EmailReminderProcessor(
      { claimExecutionForSending: vi.fn() } as never,
      { sendMail: vi.fn(), sendMailMultipart: vi.fn() },
      STUB_ENV,
      { getSettings: vi.fn() } as never,
      logger,
      null,
    );
  }

  interface FailureSeam {
    onJobFailed(job: Job<EmailReminderJobData> | undefined, error: Error): void;
  }

  it.each([
    ["null", null],
    ["a primitive", 42],
    ["a non-object string", "not-a-payload"],
  ])(
    "logs the original failure without throwing when job data is %s",
    (_label, data) => {
      const logger = makeSpyLogger();
      const processor = makeProcessor(logger);

      expect(() =>
        (processor as unknown as FailureSeam).onJobFailed(
          jobWithData<EmailReminderJobData>(data),
          new Error("SMTP down"),
        ),
      ).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        "email-reminder job failed",
        expect.objectContaining({
          error: "SMTP down",
          executionId: undefined,
        }),
      );
      expect(logger.warn).not.toHaveBeenCalled();
    },
  );

  it("logs the failure with no identity when the job itself is missing", () => {
    const logger = makeSpyLogger();
    const processor = makeProcessor(logger);

    expect(() =>
      (processor as unknown as FailureSeam).onJobFailed(
        undefined,
        new Error("job payload lost"),
      ),
    ).not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      "email-reminder job failed",
      expect.objectContaining({ error: "job payload lost" }),
    );
  });

  it("keeps the execution id and trace fields for a well-formed payload", () => {
    const logger = makeSpyLogger();
    const processor = makeProcessor(logger);
    const traceparent =
      "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";

    (processor as unknown as FailureSeam).onJobFailed(
      jobWithData<EmailReminderJobData>({
        executionId: "exec-1",
        traceparent,
      }),
      new Error("SMTP down"),
    );

    expect(logger.error).toHaveBeenCalledWith(
      "email-reminder job failed",
      expect.objectContaining({
        executionId: "exec-1",
        traceId: "0af7651916cd43dd8448eb211c80319c",
        error: "SMTP down",
      }),
    );
  });
});

describe("PdfExportProcessor.onJobFailed malformed payloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  interface FailureSeam {
    onJobFailed(
      job: Job<{ jobId?: string }> | undefined,
      error: Error,
    ): Promise<void>;
  }

  function makeProcessor(logger: AppLogger = createNullLogger()) {
    const service = {
      reconcileTerminalState: vi.fn().mockResolvedValue(true),
      markExportCompleted: vi.fn(),
      markExportFailed: vi.fn(),
    };
    const processor = new PdfExportProcessor(
      service as never,
      { render: vi.fn() },
      STUB_ENV,
      logger,
      null,
      { get: vi.fn() },
    );
    return { processor, service };
  }

  it.each([
    ["null", null],
    ["a primitive", 7],
    ["a missing identity", { reportId: "report-1" }],
  ])(
    "emits one safe diagnostic and skips reconciliation when job data is %s",
    async (_label, data) => {
      const logger = makeSpyLogger();
      const { processor, service } = makeProcessor(logger);

      await (processor as unknown as FailureSeam).onJobFailed(
        jobWithData<{ jobId?: string }>(data),
        new Error("renderer crashed"),
      );

      expect(logger.error).toHaveBeenCalledWith(
        "pdf-export job failed",
        expect.objectContaining({ error: "renderer crashed" }),
      );
      expect(logger.error).toHaveBeenCalledWith(
        "pdf-export failed event identity rejected",
        expect.objectContaining({ queueJobId: undefined }),
      );
      expect(service.reconcileTerminalState).not.toHaveBeenCalled();
    },
  );

  it("does not create an unhandled rejection when the failed event carries a null payload", async () => {
    const logger = makeSpyLogger();
    const { processor, service } = makeProcessor(logger);
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      processor.onModuleInit();
      const failedHandler = workerInstances().at(-1)?.handlers.failed;
      expect(failedHandler).toBeTypeOf("function");

      failedHandler?.(
        jobWithData(null) as never,
        new Error("delivery refused") as never,
      );

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          "pdf-export failed event identity rejected",
          expect.objectContaining({ queueJobId: undefined }),
        );
      });
      await flushAsync();

      expect(unhandledRejections).toStrictEqual([]);
      expect(service.reconcileTerminalState).not.toHaveBeenCalled();
      expect(Sentry.captureException).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });

  it("still reconciles a well-formed failed job", async () => {
    const { processor, service } = makeProcessor();
    const data = {
      reportId: "report-1",
      jobId: "job-1",
      requestedBy: "user-1",
      generation: 1,
    };
    const job = {
      id: "job-1-g1",
      data,
      attemptsMade: 3,
      opts: { attempts: 3 },
    } as unknown as Job<{ jobId?: string }>;

    await (processor as unknown as FailureSeam).onJobFailed(
      job,
      new Error("renderer crashed"),
    );

    expect(service.reconcileTerminalState).toHaveBeenCalledExactlyOnceWith(
      {
        jobId: "job-1",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1,
      },
      expect.any(Function),
    );
  });
});
