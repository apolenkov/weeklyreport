import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MockTelegramAdapter } from "./mock-telegram.adapter";

describe("MockTelegramAdapter (Phase 55 / UFB-056)", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
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

  it("emits a structured JSON log line per send", async () => {
    const adapter = new MockTelegramAdapter();
    await adapter.send("chat-1", "body");
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const firstCall = writeSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    const payload = JSON.parse((firstCall?.[0] as string).trim());
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
