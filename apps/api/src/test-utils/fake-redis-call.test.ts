import type { Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isRateLimitRedisReply } from "../infrastructure/throttler/rate-limit.middleware";
import { createFakeRedisCall } from "./fake-redis-call";

const WINDOW_MS = 100;
const storeOptions = { windowMs: WINDOW_MS } as Options;

afterEach(() => vi.useRealTimers());

describe("fake Redis with the current real RedisStore consumer", () => {
  it("reads an expired key as absent and starts a fresh increment window", async () => {
    vi.useFakeTimers();
    const fake = createFakeRedisCall();
    const store = new RedisStore({
      sendCommand: async (...args) => {
        const reply = await fake.call(...args);
        if (!isRateLimitRedisReply(reply))
          throw new Error("Unexpected Redis reply");
        return reply;
      },
    });
    await store.init(storeOptions);
    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 1,
    });
    await expect(store.get("client")).resolves.toMatchObject({ totalHits: 1 });
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    await expect(store.get("client")).resolves.toMatchObject({ totalHits: 0 });
    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 1,
    });
  });

  it("reloads the normal increment script after the transport restarts empty", async () => {
    let transport = createFakeRedisCall();
    const store = new RedisStore({
      sendCommand: async (...args) => {
        const reply = await transport.call(...args);
        if (!isRateLimitRedisReply(reply))
          throw new Error("Unexpected Redis reply");
        return reply;
      },
    });
    await store.init(storeOptions);
    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 1,
    });
    transport = createFakeRedisCall();
    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 1,
    });
    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 2,
    });
  });
});
