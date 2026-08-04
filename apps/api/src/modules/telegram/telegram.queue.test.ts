import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { dlqFailedTotal } from "../../infrastructure/metrics/metrics.registry.js";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { MockTelegramAdapter } from "./mock-telegram.adapter";
import type { TelegramAdapter, TelegramSendResult } from "./telegram.adapter";
import {
  TELEGRAM_OUTBOUND_JOB_OPTS,
  TELEGRAM_OUTBOUND_QUEUE_NAME,
  type TelegramOutboundJobData,
  TelegramProcessor as ProductionTelegramProcessor,
} from "./telegram.queue";

// Invoke private processJob via shim so the redis-less unit test stays hermetic.
// Env is only read in onModuleInit (not exercised here).
const STUB_ENV = { REDIS_HOST: "localhost", REDIS_PORT: 6379 } as EnvConfig;

class TestProcessor extends ProductionTelegramProcessor {
  constructor(
    adapter: TelegramAdapter,
    env: EnvConfig,
    logger: AppLogger = createNullLogger(),
  ) {
    super(adapter, env, logger, null);
  }

  public async invoke(data: TelegramOutboundJobData): Promise<void> {
    await (
      this as unknown as {
        processJob(job: { data: TelegramOutboundJobData }): Promise<void>;
      }
    ).processJob({ data });
  }

  public logFailureForTest(
    job: Job<TelegramOutboundJobData> | undefined,
    error: Error,
  ): void {
    (
      this as unknown as {
        onJobFailed(
          job: Job<TelegramOutboundJobData> | undefined,
          error: Error,
        ): void;
      }
    ).onJobFailed(job, error);
  }
}

function createSpyLogger(): AppLogger {
  const logger: AppLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

describe("TelegramProcessor", () => {
  it("forwards chatId + text to the injected adapter", async () => {
    const adapter = new MockTelegramAdapter();
    const proc = new TestProcessor(adapter, STUB_ENV);
    await proc.invoke({ chatId: "chat-1", text: "hello" });
    expect(adapter.lastPayload).toEqual({ chatId: "chat-1", text: "hello" });
  });

  it("throws when the adapter returns { ok: false } so BullMQ retries", async () => {
    const failingAdapter: TelegramAdapter = {
      send(): Promise<TelegramSendResult> {
        return Promise.resolve({ ok: false });
      },
    };
    const proc = new TestProcessor(failingAdapter, STUB_ENV);
    await expect(
      proc.invoke({ chatId: "chat-x", text: "body" }),
    ).rejects.toThrow(/telegram adapter rejected send/i);
  });

  it("propagates adapter exceptions (network errors fail the job)", async () => {
    const throwingAdapter: TelegramAdapter = {
      send(): Promise<TelegramSendResult> {
        return Promise.reject(new Error("ENETDOWN"));
      },
    };
    const proc = new TestProcessor(throwingAdapter, STUB_ENV);
    await expect(
      proc.invoke({ chatId: "chat-y", text: "body" }),
    ).rejects.toThrow("ENETDOWN");
  });
});

describe("TelegramProcessor failure logging", () => {
  it("logs a terminal failure through AppLogger with the job correlationId", () => {
    const logger = createSpyLogger();
    const proc = new TestProcessor(new MockTelegramAdapter(), STUB_ENV, logger);

    proc.logFailureForTest(
      {
        data: { chatId: "chat-1", text: "hi", correlationId: "corr-9" },
        attemptsMade: 3,
      } as Job<TelegramOutboundJobData>,
      new Error("boom"),
    );

    expect(logger.error).toHaveBeenCalledWith(
      "telegram-outbound job failed",
      expect.objectContaining({ correlationId: "corr-9", error: "boom" }),
    );
  });

  it("does not increment cr_dlq_failed_total (DLQ monitor is the sole owner)", () => {
    const inc = vi.spyOn(dlqFailedTotal, "inc");
    const proc = new TestProcessor(
      new MockTelegramAdapter(),
      STUB_ENV,
      createSpyLogger(),
    );

    proc.logFailureForTest(
      {
        data: { chatId: "chat-1", text: "hi" },
        attemptsMade: 3,
      } as Job<TelegramOutboundJobData>,
      new Error("boom"),
    );

    expect(inc).not.toHaveBeenCalled();
    inc.mockRestore();
  });
});

describe("telegram.queue constants", () => {
  it("exposes the canonical queue name used by BullMQ registration", () => {
    expect(TELEGRAM_OUTBOUND_QUEUE_NAME).toBe("telegram-outbound");
  });

  it("default job opts request 3 attempts with exponential backoff", () => {
    expect(TELEGRAM_OUTBOUND_JOB_OPTS.attempts).toBe(3);
    expect(TELEGRAM_OUTBOUND_JOB_OPTS.backoff.type).toBe("exponential");
    expect(TELEGRAM_OUTBOUND_JOB_OPTS.backoff.delay).toBe(5000);
  });
});
