import { describe, expect, it, vi } from "vitest";

import type { AnalyticsCachePort } from "./analytics.service.js";

/**
 * Contract test for the AnalyticsCachePort behavior:
 * - Reads short-circuit on cache hit.
 * - Invalidation removes only `customreport:analytics:*` prefixed keys.
 *
 * The real AnalyticsCache (Redis-backed, in analytics.cache.ts) wraps the
 * same contract; this test uses an in-memory fake so no Redis is required.
 */

interface InvalidatableCache extends AnalyticsCachePort {
  invalidateAll(): Promise<void>;
}

function inMemoryCache(): {
  cache: InvalidatableCache;
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  return {
    store,
    cache: {
      async getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const hit = store.get(key);
        if (hit !== undefined) return JSON.parse(hit) as T;
        const fresh = await fn();
        store.set(key, JSON.stringify(fresh));
        return fresh;
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- implements InvalidatableCache interface (Promise<void> return type required by the port contract; no awaitable work in this in-memory stub)
      async invalidateAll() {
        for (const k of Array.from(store.keys())) {
          if (k.startsWith("customreport:analytics:")) store.delete(k);
        }
      },
    },
  };
}

describe("AnalyticsCache contract", () => {
  it("hits the cache on the second call to the same key", async () => {
    const { cache } = inMemoryCache();
    // eslint-disable-next-line @typescript-eslint/require-await -- fn parameter typed as () => Promise<T>; async is required to satisfy the contract (no awaitable work in this stub)
    const fn = vi.fn(async () => ({ ok: true }));

    await cache.getOrCompute("customreport:analytics:k", fn);
    await cache.getOrCompute("customreport:analytics:k", fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("invalidateAll clears prefixed keys and leaves others alone", async () => {
    const { cache, store } = inMemoryCache();

    // eslint-disable-next-line @typescript-eslint/require-await -- fn parameter typed as () => Promise<T>; async is required to satisfy the contract (no awaitable work in this stub)
    await cache.getOrCompute("customreport:analytics:a", async () => ({
      a: 1,
    }));
    // eslint-disable-next-line @typescript-eslint/require-await -- fn parameter typed as () => Promise<T>; async is required to satisfy the contract (no awaitable work in this stub)
    await cache.getOrCompute("customreport:analytics:b", async () => ({
      b: 2,
    }));
    store.set("other:keep", "preserved");

    await cache.invalidateAll();

    expect(store.has("customreport:analytics:a")).toBe(false);
    expect(store.has("customreport:analytics:b")).toBe(false);
    expect(store.has("other:keep")).toBe(true);
  });

  it("serialises and deserialises payloads correctly", async () => {
    const { cache } = inMemoryCache();
    const value = {
      periods: ["2026-04-21"],
      rows: [{ projectId: "p", name: "A" }],
    };
    const seen = await cache.getOrCompute(
      "customreport:analytics:roundtrip",
      // eslint-disable-next-line @typescript-eslint/require-await -- fn parameter typed as () => Promise<T>; async is required to satisfy the contract (no awaitable work in this stub)
      async () => value,
    );
    const cached = await cache.getOrCompute(
      "customreport:analytics:roundtrip",
      // eslint-disable-next-line @typescript-eslint/require-await -- fn parameter typed as () => Promise<T>; async is required to satisfy the contract (no awaitable work in this stub)
      async () => ({ unreached: true }),
    );
    expect(seen).toEqual(value);
    expect(cached).toEqual(value);
  });
});
