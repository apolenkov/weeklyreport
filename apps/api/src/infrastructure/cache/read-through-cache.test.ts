// Asserts keyPrefix composition (Redis key) vs the caller-supplied key —
// the behavior analytics/telemetry wrappers rely on but never cover themselves.
import { Readable } from "node:stream";

import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../config/env.schema";
import { redisCacheErrorsTotal } from "../metrics/metrics.registry.js";
import { createRedisReadThroughCache } from "./read-through-cache.js";

interface FakeRedisInstance {
  store: Map<string, string>;
  ttls: Map<string, number>;
  failGet: boolean;
  failDel: boolean;
  failScanStream: boolean;
  failQuit: boolean;
  emptyFirstBatch: boolean;
  injectInvalidationOnEval: boolean;
  injectMalformedEvalResult: boolean;
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<string>;
  incr(key: string): Promise<number>;
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
  on(event: string, handler: (error: unknown) => void): void;
  errorHandlers: ((error: unknown) => void)[];
}

const { instances } = vi.hoisted(() => ({
  instances: [] as FakeRedisInstance[],
}));

vi.mock("ioredis", () => {
  class FakeRedis {
    readonly store = new Map<string, string>();
    // The TTL is recorded so a case can prove ttlSeconds reaches Redis.
    readonly ttls = new Map<string, number>();
    readonly errorHandlers: ((error: unknown) => void)[] = [];
    // Degraded paths are injectable: a fake that cannot fail never reaches the
    // catch blocks the module is responsible for.
    failGet = false;
    failDel = false;
    failScanStream = false;
    failQuit = false;
    emptyFirstBatch = false;
    // Set by a case that wants the state-read script to return a non-pair.
    injectMalformedEvalResult = false;
    // Set by a case that wants the invalidation to land inside the write window.
    injectInvalidationOnEval = false;
    constructor() {
      instances.push(this);
    }
    on(_event: string, handler: (error: unknown) => void): this {
      this.errorHandlers.push(handler);
      return this;
    }
    get(key: string): Promise<string | null> {
      if (this.failGet) {
        return Promise.reject(new Error("redis get failed"));
      }
      return Promise.resolve(this.store.get(key) ?? null);
    }
    setex(key: string, ttl: number, value: string): Promise<string> {
      this.store.set(key, value);
      this.ttls.set(key, ttl);
      return Promise.resolve("OK");
    }
    scanStream(options: { match: string }): Readable {
      if (this.failScanStream) {
        const failing = new Readable({
          objectMode: true,
          // Nothing is pushed; the destroy below is the only event.
          read: () => undefined,
        });
        queueMicrotask(() => failing.destroy(new Error("scan stream failed")));
        return failing;
      }
      const prefix = options.match.replace(/\*$/, "");
      const keys = [...this.store.keys()].filter((k) => k.startsWith(prefix));
      // SCAN may yield an empty batch before a non-empty one.
      const batches = this.emptyFirstBatch ? [[], keys] : [keys];
      return Readable.from(batches, { objectMode: true });
    }
    incr(key: string): Promise<number> {
      const next = Number(this.store.get(key) ?? "0") + 1;
      this.store.set(key, String(next));
      return Promise.resolve(next);
    }
    // Mirrors WRITE_IF_GENERATION_MATCHES: compare the epoch, then SET with EX.
    eval(
      _script: string,
      numKeys: number,
      ...args: string[]
    ): Promise<unknown> {
      const keys = args.slice(0, numKeys);
      const argv = args.slice(numKeys);
      if (argv.length === 0) {
        // READ_STATE_SCRIPT: entry + epoch in one round trip. The fake
        // executes synchronously, so no invalidation can land between them —
        // that atomicity is exactly what the test below pins.
        if (this.injectMalformedEvalResult) {
          return Promise.resolve("not-a-pair");
        }
        const [entryKey, generationKey] = keys as [string, string];
        return Promise.resolve([
          this.store.get(entryKey) ?? null,
          this.store.get(generationKey) ?? "0",
        ]);
      }
      const [generationKey, entryKey] = keys as [string, string];
      const [expected, value, ttl] = argv as [string, string, string];
      if (this.injectInvalidationOnEval) {
        // An invalidation lands exactly in the window between the epoch read and
        // the write; the atomic script must still refuse to store the value.
        const next = Number(this.store.get(generationKey) ?? "0") + 1;
        this.store.set(generationKey, String(next));
      }
      const current = this.store.get(generationKey) ?? "0";
      if (current !== expected) {
        return Promise.resolve(0);
      }
      this.store.set(entryKey, value);
      this.ttls.set(entryKey, Number(ttl));
      return Promise.resolve(1);
    }
    del(...keys: string[]): Promise<number> {
      if (this.failDel) {
        return Promise.reject(new Error("redis del failed"));
      }
      keys.forEach((k) => this.store.delete(k));
      return Promise.resolve(keys.length);
    }
    quit(): Promise<string> {
      if (this.failQuit) {
        return Promise.reject(new Error("redis quit failed"));
      }
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

  it("does not cache a value from a compute that an invalidation overtook", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    const release = Promise.withResolvers<void>();
    const compute = vi.fn(async () => {
      await release.promise;
      return "pre-publish";
    });

    const pending = cache.getOrCompute("k", compute);
    // The compute has started, so its epoch read already happened.
    await vi.waitFor(() => expect(compute).toHaveBeenCalledOnce());
    // The publish commits while the compute is still running.
    await cache.invalidateByPrefix("k");
    release.resolve();
    await expect(pending).resolves.toBe("pre-publish");

    // The stale value must not be readable, and the next call recomputes.
    expect(storeOf().has("p:k")).toBe(false);
    await expect(
      cache.getOrCompute("k", () => Promise.resolve("post")),
    ).resolves.toBe("post");
    expect(storeOf().get("p:k")).toBe(JSON.stringify("post"));
  });

  it("skips the write for a non-serializable result instead of caching an empty string", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 30,
      keyPrefix: "p:",
    });
    const incSpy = vi.spyOn(redisCacheErrorsTotal, "inc");

    await expect(
      cache.getOrCompute<string | undefined>("k", () =>
        Promise.resolve(undefined),
      ),
    ).resolves.toBeUndefined();

    expect(storeOf().has("p:k")).toBe(false);
    expect(incSpy).not.toHaveBeenCalled();
    // A second call recomputes cleanly: no empty-string parse failure.
    await expect(
      cache.getOrCompute<string | undefined>("k", () =>
        Promise.resolve(undefined),
      ),
    ).resolves.toBeUndefined();
    expect(incSpy).not.toHaveBeenCalled();
  });

  it("records the TTL that reaches Redis", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 45,
      keyPrefix: "p:",
    });

    await cache.getOrCompute("k", () => Promise.resolve("v"));

    expect(redisOf().ttls.get("p:k")).toBe(45);
  });

  it("counts a throwing validator as a validation failure, not a parse failure", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    storeOf().set("p:k", JSON.stringify("cached"));
    const incSpy = vi.spyOn(redisCacheErrorsTotal, "inc");
    const warnSpy = vi.spyOn(Logger.prototype, "warn");
    const validate = (_value: unknown): _value is string => {
      throw new Error("validator exploded");
    };

    await expect(
      cache.getOrCompute("k", () => Promise.resolve("fresh"), validate),
    ).resolves.toBe("fresh");

    expect(incSpy).toHaveBeenCalledWith({ operation: "validation" });
    expect(incSpy).not.toHaveBeenCalledWith({ operation: "parse" });
    expect(warnSpy).toHaveBeenCalledWith(
      "cache value validator threw; recomputing",
      expect.objectContaining({ error: "validator exploded" }),
    );
  });

  it("attributes a failed batch delete to delete, not to scan", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    storeOf().set("p:k", JSON.stringify("v"));
    const redis = redisOf();
    redis.failDel = true;
    const incSpy = vi.spyOn(redisCacheErrorsTotal, "inc");
    const warnSpy = vi.spyOn(Logger.prototype, "warn");

    await expect(cache.invalidateByPrefix("k")).resolves.toBeUndefined();

    expect(incSpy).toHaveBeenCalledWith({ operation: "delete" });
    expect(incSpy).not.toHaveBeenCalledWith({ operation: "scan" });
    expect(warnSpy).toHaveBeenCalledWith(
      "cache invalidation delete failed",
      expect.objectContaining({ phase: "cache.invalidate" }),
    );
  });

  it("logs and counts a failing scan stream without throwing", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    redisOf().failScanStream = true;
    const incSpy = vi.spyOn(redisCacheErrorsTotal, "inc");

    await expect(cache.invalidateByPrefix("k")).resolves.toBeUndefined();

    expect(incSpy).toHaveBeenCalledWith({ operation: "scan" });
  });

  it("resolves close even when quit rejects, and counts the connection failure", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    redisOf().failQuit = true;
    const incSpy = vi.spyOn(redisCacheErrorsTotal, "inc");

    await expect(cache.close()).resolves.toBeUndefined();

    expect(incSpy).toHaveBeenCalledWith({ operation: "connection" });
  });

  it("skips an empty scan batch and still deletes the next one", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    storeOf().set("p:k", JSON.stringify("v"));
    redisOf().emptyFirstBatch = true;

    await cache.invalidateByPrefix("k");

    expect(storeOf().has("p:k")).toBe(false);
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

  it("falls through to compute when the state script rejects", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    vi.spyOn(redisOf(), "eval").mockRejectedValueOnce(
      new Error("Redis unavailable"),
    );
    const compute = vi.fn().mockResolvedValue({ fresh: true });

    await expect(cache.getOrCompute("k", compute)).resolves.toEqual({
      fresh: true,
    });
    expect(compute).toHaveBeenCalledOnce();
  });

  it("returns a BigInt result instead of rejecting inside JSON.stringify", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });

    await expect(
      cache.getOrCompute("k", () => Promise.resolve(10n)),
    ).resolves.toBe(10n);
    expect(storeOf().has("p:k")).toBe(false);
  });

  it("returns a circular result instead of rejecting inside JSON.stringify", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    const circular: { self?: unknown; name: string } = { name: "loop" };
    circular.self = circular;

    await expect(
      cache.getOrCompute("k", () => Promise.resolve(circular)),
    ).resolves.toBe(circular);
    expect(storeOf().has("p:k")).toBe(false);
  });

  it("does not store a value when an invalidation lands between the epoch read and the write", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    // The epoch is read before the compute; the fake then bumps it immediately
    // before the atomic write runs, which is the window the script closes.
    redisOf().injectInvalidationOnEval = true;

    await expect(
      cache.getOrCompute("k", () => Promise.resolve("stale")),
    ).resolves.toBe("stale");
    expect(storeOf().has("p:k")).toBe(false);

    // With the window closed the next compute stores normally.
    redisOf().injectInvalidationOnEval = false;
    await expect(
      cache.getOrCompute("k", () => Promise.resolve("fresh")),
    ).resolves.toBe("fresh");
    expect(storeOf().get("p:k")).toBe(JSON.stringify("fresh"));
  });

  it("reads entry and epoch in one round trip: no separate GETs on the read path", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    storeOf().set("p:k", JSON.stringify("cached"));
    const getSpy = vi.spyOn(redisOf(), "get");

    await expect(
      cache.getOrCompute("k", () => Promise.resolve("recomputed")),
    ).resolves.toBe("cached");
    // The hit came from the atomic state script, not from pairwise GETs:
    // an invalidation has no window between the entry and epoch reads.
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("falls through to compute when the state script returns a malformed shape", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    redisOf().injectMalformedEvalResult = true;

    await expect(
      cache.getOrCompute("k", () => Promise.resolve("fresh")),
    ).resolves.toBe("fresh");
    expect(storeOf().has("p:k")).toBe(false);
  });

  it("returns the computed value when the cache write rejects", async () => {
    const cache = createRedisReadThroughCache({
      connection: CONNECTION,
      loggerName: "Test",
      ttlSeconds: 60,
      keyPrefix: "p:",
    });
    vi.spyOn(redisOf(), "eval").mockRejectedValueOnce(
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

  it.each(["", "__invalidation"])(
    "preserves the generation fence when invalidating prefix %j",
    async (prefix) => {
      const cache = createRedisReadThroughCache({
        connection: CONNECTION,
        loggerName: "Test",
        ttlSeconds: 60,
        keyPrefix: "p:",
      });
      await cache.getOrCompute("__invalidation:data", () =>
        Promise.resolve("old"),
      );
      await cache.invalidateByPrefix(prefix);
      expect(storeOf().has("p:__invalidation:data")).toBe(false);
      // Observe the command boundary: metadata is never a DEL target.
      expect(storeOf().get("p:__invalidation_generation")).toBe("1");
    },
  );

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
    const isNumber = (value: unknown): value is number => validate(value);

    await cache.getOrCompute("k", fn, isNumber);
    await cache.getOrCompute("k", fn, isNumber);

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
    const isNumber = (value: unknown): value is number => validate(value);
    const compute = vi.fn(() => Promise.resolve(99));

    const result = await cache.getOrCompute("k", compute, isNumber);

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
    vi.spyOn(redisOf(), "eval").mockRejectedValueOnce(
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

  it("warns and counts a state-script failure instead of swallowing it", async () => {
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
    vi.spyOn(redisOf(), "eval").mockRejectedValueOnce(
      new Error("generation unavailable"),
    );

    await expect(
      cache.getOrCompute("k", () => Promise.resolve("fresh")),
    ).resolves.toBe("fresh");

    expect(incSpy).toHaveBeenCalledWith({ operation: "read" });
    expect(warnSpy).toHaveBeenCalledWith(
      "cache read failed; falling through to compute",
      expect.objectContaining({
        phase: "cache.read",
        error: "generation unavailable",
      }),
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
    vi.spyOn(redisOf(), "eval")
      .mockResolvedValueOnce([null, "0"])
      .mockRejectedValueOnce(new Error("write refused"));

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
