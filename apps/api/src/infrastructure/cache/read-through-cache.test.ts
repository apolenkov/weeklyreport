/**
 * Unit tests for the shared read-through cache. `ioredis` is replaced by an
 * in-memory fake (a Map) so the tests run without infrastructure and can
 * assert the one behavior the analytics/telemetry wrappers rely on but never
 * covered: keyPrefix composition (the Redis key) vs the caller-supplied key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../config/env.schema";
import { createRedisReadThroughCache } from "./read-through-cache.js";

const { instances } = vi.hoisted(() => ({
  instances: [] as { store: Map<string, string> }[],
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
    scan(
      _cursor: string,
      _match: string,
      pattern: string,
    ): Promise<[string, string[]]> {
      const prefix = pattern.replace(/\*$/, "");
      const keys = [...this.store.keys()].filter((k) => k.startsWith(prefix));
      return Promise.resolve(["0", keys]);
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
  return instances[0].store;
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
});
