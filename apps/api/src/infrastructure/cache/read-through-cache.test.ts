// Asserts keyPrefix composition (Redis key) vs the caller-supplied key —
// the behavior analytics/telemetry wrappers rely on but never cover themselves.
import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../config/env.schema";
import { createRedisReadThroughCache } from "./read-through-cache.js";

const { instances } = vi.hoisted(() => ({
  instances: [] as {
    store: Map<string, string>;
    get(key: string): Promise<string | null>;
    setex(key: string, ttl: number, value: string): Promise<string>;
  }[],
}));

vi.mock("ioredis", () => {
  class FakeRedis {
    readonly store = new Map<string, string>();
    constructor() {
      instances.push(this);
    }
    on(): this {
      return this;
    }
    get(key: string): Promise<string | null> {
      return Promise.resolve(this.store.get(key) ?? null);
    }
    setex(key: string, _ttl: number, value: string): Promise<string> {
      this.store.set(key, value);
      return Promise.resolve("OK");
    }
    scanStream(options: { match: string }): Readable {
      const prefix = options.match.replace(/\*$/, "");
      const keys = [...this.store.keys()].filter((k) => k.startsWith(prefix));
      return Readable.from([keys], { objectMode: true });
    }
    del(...keys: string[]): Promise<number> {
      keys.forEach((k) => this.store.delete(k));
      return Promise.resolve(keys.length);
    }
    quit(): Promise<string> {
      return Promise.resolve("OK");
    }
  }
  return { default: FakeRedis };
});

const CONNECTION: Pick<EnvConfig, "REDIS_HOST" | "REDIS_PORT"> = {
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
};

function storeOf(): Map<string, string> {
  const [instance] = instances;
  if (!instance) throw new Error("FakeRedis was never instantiated");
  return instance.store;
}

function redisOf() {
  const [instance] = instances;
  if (!instance) throw new Error("FakeRedis was never instantiated");
  return instance;
}

describe("createRedisReadThroughCache", () => {
  beforeEach(() => {
    instances.length = 0;
  });

  it("prepends keyPrefix before the key reaches Redis", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "customreport:telemetry:",
    });

    await cache.getOrCompute("summary:v1", () => Promise.resolve({ n: 1 }));

    const store = storeOf();
    expect(store.has("customreport:telemetry:summary:v1")).toBe(true);
    expect(store.has("summary:v1")).toBe(false);
  });

  it("passes the key through unchanged when keyPrefix is empty", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 3600,
      keyPrefix: "",
    });

    await cache.getOrCompute("customreport:analytics:k", () =>
      Promise.resolve(1),
    );

    expect(storeOf().has("customreport:analytics:k")).toBe(true);
  });

  it("short-circuits the compute function on a cache hit", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    const fn = vi.fn(() => Promise.resolve(42));

    await cache.getOrCompute("k", fn);
    await cache.getOrCompute("k", fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("falls through to compute when Redis get rejects", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    vi.spyOn(redisOf(), "get").mockRejectedValueOnce(
      new Error("Redis unavailable"),
    );
    const compute = vi.fn().mockResolvedValue({ fresh: true });

    await expect(cache.getOrCompute("k", compute)).resolves.toEqual({
      fresh: true,
    });
    expect(compute).toHaveBeenCalledOnce();
  });

  it("returns the computed value when Redis setex rejects", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    vi.spyOn(redisOf(), "setex").mockRejectedValueOnce(
      new Error("Redis unavailable"),
    );

    await expect(
      cache.getOrCompute("k", () => Promise.resolve(42)),
    ).resolves.toBe(42);
    expect(storeOf().has("p:k")).toBe(false);
  });

  it("invalidateByPrefix deletes only keys under the prefix", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 3600,
      keyPrefix: "",
    });
    await cache.getOrCompute("customreport:analytics:a", () =>
      Promise.resolve(1),
    );
    await cache.getOrCompute("customreport:analytics:b", () =>
      Promise.resolve(2),
    );
    await cache.getOrCompute("other:keep", () => Promise.resolve(3));

    await cache.invalidateByPrefix("customreport:analytics:");

    const store = storeOf();
    expect(store.has("customreport:analytics:a")).toBe(false);
    expect(store.has("customreport:analytics:b")).toBe(false);
    expect(store.has("other:keep")).toBe(true);
  });

  it("prepends keyPrefix when invalidating a caller prefix", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 3600,
      keyPrefix: "cache:",
    });
    await cache.getOrCompute("analytics:a", () => Promise.resolve(1));
    await cache.getOrCompute("telemetry:keep", () => Promise.resolve(2));

    await cache.invalidateByPrefix("analytics:");

    expect(storeOf().has("cache:analytics:a")).toBe(false);
    expect(storeOf().has("cache:telemetry:keep")).toBe(true);
  });
});
