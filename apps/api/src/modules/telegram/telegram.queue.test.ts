import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { dlqFailedTotal } from "../../infrastructure/metrics/metrics.registry.js";
import type { AppLogger } from "../../lib/logger.js";
import { MockTelegramAdapter } from "./mock-telegram.adapter";
import type { TelegramAdapter, TelegramSendResult } from "./telegram.adapter";
import {
  TELEGRAM_OUTBOUND_JOB_OPTS,
  TELEGRAM_OUTBOUND_QUEUE_NAME,
  type TelegramOutboundJobData,
  TelegramProcessor,
} from "./telegram.queue";

// Verifies the processor's pure dispatch logic without instantiating a real
// BullMQ Worker — we invoke the private `processJob` through a thin shim so
// the redis-less unit test stays hermetic. Worker startup itself is covered
// by the integration suite (when one lands for telegram in a follow-on phase).
// The processor reads env only in onModuleInit (not exercised here); a minimal
// stub satisfies the inherited constructor.
const STUB_ENV = { REDIS_HOST: "localhost", REDIS_PORT: 6379 } as EnvConfig;

class TestProcessor extends TelegramProcessor {
  public async invoke(data: TelegramOutboundJobData): Promise<void> {
    // Cast through unknown so we can call the private method from the test
    // without exposing it on the public API.
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

describe("TelegramProcessor (Phase 55 / UFB-056)", () => {
  it("forwards chatId + text to the injected adapter", async () => {
    const adapter = new MockTelegramAdapter();
    const proc = new TestProcessor(adapter, STUB_ENV);
    await proc.invoke({ chatId: "chat-1", text: "hello" });
    expect(adapter.lastPayload).toEqual({ chatId: "chat-1", text: "hello" });
  });

  it("throws when the adapter returns { ok: false } so BullMQ retries", async () => {
    const failingAdapter: TelegramAdapter = {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async TelegramAdapter contract (no awaitable work in the stub)
      async send(): Promise<TelegramSendResult> {
        return { ok: false };
      },
    };
    const proc = new TestProcessor(failingAdapter, STUB_ENV);
    await expect(
      proc.invoke({ chatId: "chat-x", text: "body" }),
    ).rejects.toThrow(/telegram adapter rejected send/i);
  });

  it("propagates adapter exceptions (network errors fail the job)", async () => {
    const throwingAdapter: TelegramAdapter = {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async TelegramAdapter contract (throws synchronously to simulate network error)
      async send(): Promise<TelegramSendResult> {
        throw new Error("ENETDOWN");
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

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
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
    expect(TELEGRAM_OUTBOUND_JOB_OPTS.backoff.delay).toBeGreaterThanOrEqual(
      1000,
    );
  });
});
