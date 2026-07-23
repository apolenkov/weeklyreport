import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { telegramMessageSentTotal } from "../../infrastructure/metrics/metrics.registry";
import { MockTelegramAdapter } from "./mock-telegram.adapter";

describe("MockTelegramAdapter", () => {
  let writeSpy: MockInstance<typeof process.stderr.write>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns { ok: true } for any non-empty input", async () => {
    const adapter = new MockTelegramAdapter();
    const result = await adapter.send("12345", "hello");
    expect(result).toEqual({ ok: true });
  });

  it("records the last payload so tests can assert without parsing logs", async () => {
    const adapter = new MockTelegramAdapter();
    await adapter.send("12345", "first");
    await adapter.send("67890", "second");
    expect(adapter.lastPayload).toEqual({ chatId: "67890", text: "second" });
  });

  it("records a successful delivery metric for every send", async () => {
    const inc = vi
      .spyOn(telegramMessageSentTotal, "inc")
      .mockImplementation(() => undefined);
    const adapter = new MockTelegramAdapter();

    await adapter.send("12345", "first");
    await adapter.send("67890", "second");

    expect(inc).toHaveBeenCalledTimes(2);
    expect(inc).toHaveBeenNthCalledWith(1, { status: "ok" });
    expect(inc).toHaveBeenNthCalledWith(2, { status: "ok" });
  });

  it("emits a structured JSON log line per send", async () => {
    const adapter = new MockTelegramAdapter();
    await adapter.send("chat-1", "body");
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const firstCall = writeSpy.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const payload = JSON.parse((firstCall?.[0] as string).trim()) as Record<
      string,
      unknown
    >;
    expect(payload.message).toBe("telegram-outbound mock send");
    expect(payload.chatId).toBe("chat-1");
    expect(payload.textLength).toBe(4);
    expect(payload.level).toBe("info");
  });

  it("starts with null lastPayload before first send", () => {
    const adapter = new MockTelegramAdapter();
    expect(adapter.lastPayload).toBeNull();
  });
});
