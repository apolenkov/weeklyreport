import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRedisReadThroughCache,
  type RedisReadThroughCache,
} from "../../infrastructure/cache/read-through-cache.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { AnalyticsCache } from "./analytics.cache.js";

vi.mock("../../infrastructure/cache/read-through-cache.js", () => ({
  createRedisReadThroughCache: vi.fn(),
}));

interface InMemoryCache {
  readonly cache: RedisReadThroughCache;
  readonly values: Map<string, unknown>;
}

function createInMemoryCache(): InMemoryCache {
  const values = new Map<string, unknown>();
  return {
    values,
    cache: {
      async getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T> {
        if (values.has(key)) return values.get(key) as T;
        const value = await fn();
        values.set(key, value);
        return value;
      },
      invalidateByPrefix(prefix: string): Promise<void> {
        for (const key of values.keys()) {
          if (key.startsWith(prefix)) values.delete(key);
        }
        return Promise.resolve();
      },
      close: () => Promise.resolve(),
    },
  };
}

const ENV = {} as EnvConfig;

describe("AnalyticsCache", () => {
  let backing: InMemoryCache;
  let cache: AnalyticsCache;

  beforeEach(() => {
    backing = createInMemoryCache();
    vi.mocked(createRedisReadThroughCache).mockReturnValue(backing.cache);
    cache = new AnalyticsCache(ENV);
  });

  it("delegates read-through caching to the production cache seam", async () => {
    const getOrCompute = vi.spyOn(backing.cache, "getOrCompute");
    const compute = vi.fn(() => Promise.resolve({ ok: true }));

    await cache.getOrCompute("weeklyreport:analytics:k", compute);
    await cache.getOrCompute("weeklyreport:analytics:k", compute);

    expect(getOrCompute).toHaveBeenCalledTimes(2);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("invalidateAll delegates the analytics prefix and preserves other keys", async () => {
    const invalidateByPrefix = vi.spyOn(backing.cache, "invalidateByPrefix");
    backing.values.set("weeklyreport:analytics:a", { a: 1 });
    backing.values.set("weeklyreport:analytics:b", { b: 2 });
    backing.values.set("other:keep", "preserved");

    await cache.invalidateAll();

    expect(invalidateByPrefix).toHaveBeenCalledExactlyOnceWith(
      "weeklyreport:analytics:",
    );
    expect([...backing.values.entries()]).toEqual([
      ["other:keep", "preserved"],
    ]);
  });

  it("keeps cache operations callable after extraction", async () => {
    const { getOrCompute, invalidateAll, onModuleDestroy } = cache;

    await expect(
      getOrCompute("weeklyreport:analytics:k", () => Promise.resolve(42)),
    ).resolves.toBe(42);
    await expect(invalidateAll()).resolves.toBeUndefined();
    await expect(onModuleDestroy()).resolves.toBeUndefined();
  });
});
