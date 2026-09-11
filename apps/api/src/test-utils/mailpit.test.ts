import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type MailpitMessage, pollForMessage } from "./mailpit.js";

const recipient = "recipient@test.local";
const message: MailpitMessage = {
  ID: "message-1",
  MessageID: "message-1@test.local",
  Subject: "Reminder",
  From: { Name: "Reports", Address: "reports@test.local" },
  To: [{ Name: "Recipient", Address: recipient }],
  Cc: null,
  Snippet: "Please submit your report",
  Created: "2026-09-05T00:00:00Z",
};

describe("Mailpit polling deadline", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each(["headers", "body"])(
    "returns null at the total deadline when response %s stall",
    async (phase) => {
      const fetch = vi.fn<typeof globalThis.fetch>((_input, init) => {
        const signal = init?.signal;
        if (!signal) throw new Error("Polling must supply an abort signal");
        if (phase === "headers") {
          return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          });
        }
        const body = new ReadableStream({
          start(controller) {
            signal.addEventListener(
              "abort",
              () => controller.error(signal.reason),
              { once: true },
            );
          },
        });
        return Promise.resolve(new Response(body));
      });
      vi.stubGlobal("fetch", fetch);
      const result = pollForMessage(recipient, 100);
      const settled = vi.fn();
      void result.then(settled);

      await vi.advanceTimersByTimeAsync(99);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);

      await expect(result).resolves.toBeNull();
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("returns a matching message before the deadline and cancels its timer", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ messages: [] }))
      .mockResolvedValueOnce(Response.json({ messages: [message] }));
    vi.stubGlobal("fetch", fetch);
    const result = pollForMessage(recipient, 300, 100);

    await vi.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toEqual(message);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("caps the final polling interval at the remaining deadline", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(Response.json({ messages: [] })),
    );
    vi.stubGlobal("fetch", fetch);
    const result = pollForMessage(recipient, 150, 100);

    await vi.advanceTimersByTimeAsync(150);

    await expect(result).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves HTTP failures before the deadline and cancels its timer", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
    );

    await expect(pollForMessage(recipient)).rejects.toThrow(
      "Mailpit GET failed: 503",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
