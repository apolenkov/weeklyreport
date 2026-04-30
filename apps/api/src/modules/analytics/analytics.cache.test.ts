import { describe, it, expect, vi } from 'vitest';

import type { AnalyticsCachePort } from './analytics.service.js';

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

function inMemoryCache(): { cache: InvalidatableCache; store: Map<string, string> } {
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
      async invalidateAll() {
        for (const k of Array.from(store.keys())) {
          if (k.startsWith('customreport:analytics:')) store.delete(k);
        }
      },
    },
  };
}

describe('AnalyticsCache contract', () => {
  it('hits the cache on the second call to the same key', async () => {
    const { cache } = inMemoryCache();
    const fn = vi.fn(async () => ({ ok: true }));

    await cache.getOrCompute('customreport:analytics:k', fn);
    await cache.getOrCompute('customreport:analytics:k', fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('invalidateAll clears prefixed keys and leaves others alone', async () => {
    const { cache, store } = inMemoryCache();

    await cache.getOrCompute('customreport:analytics:a', async () => ({ a: 1 }));
    await cache.getOrCompute('customreport:analytics:b', async () => ({ b: 2 }));
    store.set('other:keep', 'preserved');

    await cache.invalidateAll();

    expect(store.has('customreport:analytics:a')).toBe(false);
    expect(store.has('customreport:analytics:b')).toBe(false);
    expect(store.has('other:keep')).toBe(true);
  });

  it('serialises and deserialises payloads correctly', async () => {
    const { cache } = inMemoryCache();
    const value = { periods: ['2026-04-21'], rows: [{ projectId: 'p', name: 'A' }] };
    const seen = await cache.getOrCompute('customreport:analytics:roundtrip', async () => value);
    const cached = await cache.getOrCompute('customreport:analytics:roundtrip', async () => ({ unreached: true }));
    expect(seen).toEqual(value);
    expect(cached).toEqual(value);
  });
});
