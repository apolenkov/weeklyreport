// Asserts keyPrefix composition (Redis key) vs the caller-supplied key —
// the behavior analytics/telemetry wrappers rely on but never cover themselves.
import { Readable } from "node:stream";

import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../config/env.schema";
import { redisCacheErrorsTotal } from "../metrics/metrics.registry.js";
import { createRedisReadThroughCache } from "./read-through-cache.js";

const { instances } = vi.hoisted(() => ({
  instances: [] as {
    store: Map<string, string>;
    get(key: string): Promise<string | null>;
    setex(key: string, ttl: number, value: string): Promise<string>;
    on(event: string, handler: (error: unknown) => void): void;
    errorHandlers: ((error: unknown) => void)[];
  }[],
}));

vi.mock("ioredis", () => {
  class FakeRedis {
    readonly store = new Map<string, string>();
    readonly errorHandlers: ((error: unknown) => void)[] = [];
    constructor() {
      instances.push(this);
    }
    on(_event: string, handler: (error: unknown) => void): this {
      this.errorHandlers.push(handler);
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
  return { Redis: FakeRedis };
});

const CONNECTION: Pick<EnvConfig, "REDIS_DB" | "REDIS_HOST" | "REDIS_PORT"> = {
  REDIS_DB: 15,
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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("keeps every operation callable after extraction", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "detached:",
    });
    const { getOrCompute, invalidateByPrefix, close } = cache;

    await expect(getOrCompute("key", () => Promise.resolve(42))).resolves.toBe(
      42,
    );
    await expect(invalidateByPrefix("")).resolves.toBeUndefined();
    await expect(close()).resolves.toBeUndefined();
  });

  it("short-circuits compute when a cached value passes the validator", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    storeOf().set("p:k", "42");
    const fn = vi.fn(() => Promise.resolve(42));
    const validate = vi.fn((value: unknown) => value === 42);

    await cache.getOrCompute("k", fn, validate);
    await cache.getOrCompute("k", fn, validate);

    expect(fn).not.toHaveBeenCalled();
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("recomputes and warns when a cached value fails validation", async () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    const incSpy = vi.spyOn(redisCacheErrorsTotal, "inc");
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    storeOf().set("p:k", "{}");
    const validate = vi.fn((value: unknown) => value === 42);
    const compute = vi.fn(() => Promise.resolve(99));

    const result = await cache.getOrCompute("k", compute, validate);

    expect(result).toBe(99);
    expect(compute).toHaveBeenCalledOnce();
    expect(incSpy).toHaveBeenCalledWith({ operation: "validation" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed validation"),
      expect.objectContaining({ key: "k" }),
    );
  });

  it("recomputes and warns when a cached value is not valid JSON", async () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    const incSpy = vi.spyOn(redisCacheErrorsTotal, "inc");
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    const fn = vi.fn(() => Promise.resolve(7));

    storeOf().set("p:k", "{not json");
    await cache.getOrCompute("k", fn);

    expect(fn).toHaveBeenCalledOnce();
    expect(incSpy).toHaveBeenCalledWith({ operation: "parse" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("parse failed"),
      expect.anything(),
    );
  });

  it("warns and counts a Redis read failure instead of swallowing it", async () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    const incSpy = vi.spyOn(redisCacheErrorsTotal, "inc");
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    vi.spyOn(redisOf(), "get").mockRejectedValueOnce(
      new Error("Redis unavailable"),
    );

    await expect(
      cache.getOrCompute("k", () => Promise.resolve(1)),
    ).resolves.toBe(1);

    expect(incSpy).toHaveBeenCalledWith({ operation: "read" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("cache read failed"),
      expect.objectContaining({ error: "Redis unavailable" }),
    );
  });

  it("warns and counts a Redis write failure instead of swallowing it", async () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    const incSpy = vi.spyOn(redisCacheErrorsTotal, "inc");
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    vi.spyOn(redisOf(), "setex").mockRejectedValueOnce(
      new Error("write refused"),
    );

    await expect(
      cache.getOrCompute("k", () => Promise.resolve(42)),
    ).resolves.toBe(42);

    expect(incSpy).toHaveBeenCalledWith({ operation: "write" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("cache write failed"),
      expect.anything(),
    );
  });

  it("warns (instead of silently swallowing) on a Redis connection-level error event", () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });

    const [instance] = instances;
    expect(instance?.errorHandlers.length).toBeGreaterThan(0);
    instance?.errorHandlers[0]?.(new Error("ECONNREFUSED"));

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("redis connection error"),
      expect.objectContaining({ error: "ECONNREFUSED" }),
    );
  });
});
