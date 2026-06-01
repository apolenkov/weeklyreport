import { describe, expect, it } from "vitest";

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
}

describe("TelegramProcessor (Phase 55 / UFB-056)", () => {
  it("forwards chatId + text to the injected adapter", async () => {
    const adapter = new MockTelegramAdapter();
    const proc = new TestProcessor(adapter);
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
    const proc = new TestProcessor(failingAdapter);
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
    const proc = new TestProcessor(throwingAdapter);
    await expect(
      proc.invoke({ chatId: "chat-y", text: "body" }),
    ).rejects.toThrow("ENETDOWN");
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
      1_000,
    );
  });
});
