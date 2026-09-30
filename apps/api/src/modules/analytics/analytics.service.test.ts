import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  type AnalyticsCachePort,
  type AnalyticsRepository,
  AnalyticsService,
  stableHash,
} from "./analytics.service.js";

function makeCache(): {
  cache: AnalyticsCachePort;
  store: Map<string, unknown>;
} {
  const store = new Map<string, unknown>();
  return {
    store,
    cache: {
      async getOrCompute<T>(
        key: string,
        fn: () => Promise<T>,
        validate?: (value: unknown) => value is T,
      ): Promise<T> {
        const cached = store.get(key);
        if (store.has(key) && (validate === undefined || validate(cached)))
          return cached as T;
        const value = await fn();
        store.set(key, value);
        return value;
      },
    },
  };
}

function makeRepo(
  overrides: Partial<AnalyticsRepository> = {},
): AnalyticsRepository {
  return {
    trafficLightHistory: vi.fn(() =>
      Promise.resolve({ periods: [], rows: [] }),
    ),
    leadVelocity: vi.fn(() => Promise.resolve([])),
    periodComparison: vi.fn(() =>
      Promise.resolve({ periodA: null, periodB: null, rows: [] }),
    ),
    ...overrides,
  };
}

const headA: UserSession = {
  userId: "a0000000-0000-4000-8000-0000000000a1",
  email: "head-a@test.local",
  name: "Head A",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: "a0000000-0000-4000-8000-0000000group-a",
};
const headB: UserSession = {
  ...headA,
  userId: "a0000000-0000-4000-8000-0000000000b1",
  reportingGroupId: "a0000000-0000-4000-8000-0000000group-b",
};
const adminSession: UserSession = { ...headA, role: "admin" };

describe("AnalyticsService.trafficLightHistory", () => {
  it("returns empty result when repository is empty", async () => {
    const repo = makeRepo();
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    const out = await svc.trafficLightHistory(
      { periodFrom: "2026-04-01", periodTo: "2026-04-30" },
      headA,
    );

    expect(out).toEqual({ periods: [], rows: [] });
  });

  it("returns multi-project, multi-period grid", async () => {
    const repo = makeRepo({
      trafficLightHistory: vi.fn(() =>
        Promise.resolve({
          periods: [
            { periodStart: "2026-04-15", periodEnd: "2026-04-21" },
            { periodStart: "2026-04-22", periodEnd: "2026-04-28" },
          ],
          rows: [
            {
              projectId: "11111111-1111-4111-8111-111111111111",
              projectName: "A",
              statuses: ["green" as const, "red" as const],
            },
            {
              projectId: "22222222-2222-4222-8222-222222222222",
              projectName: "B",
              statuses: ["yellow" as const, null],
            },
          ],
        }),
      ),
    });
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    const out = await svc.trafficLightHistory(
      { periodFrom: "2026-04-01", periodTo: "2026-04-30" },
      headA,
    );

    expect(out.periods).toHaveLength(2);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]?.statuses).toEqual(["green", "red"]);
    expect(out.rows[1]?.statuses).toEqual(["yellow", null]);
  });

  it("cache hit short-circuits the repository on second call (same scope)", async () => {
    const trafficLightHistory = vi.fn(() =>
      Promise.resolve({
        periods: [{ periodStart: "2026-04-22", periodEnd: "2026-04-28" }],
        rows: [],
      }),
    );
    const repo = makeRepo({ trafficLightHistory });
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    const input = {
      periodFrom: "2026-04-01" as const,
      periodTo: "2026-04-30" as const,
    };
    await svc.trafficLightHistory(input, headA);
    await svc.trafficLightHistory(input, headA);

    expect(trafficLightHistory).toHaveBeenCalledTimes(1);
  });

  it("uses stable cache keys regardless of input property order", async () => {
    const trafficLightHistory = vi.fn(() =>
      Promise.resolve({ periods: [], rows: [] }),
    );
    const repo = makeRepo({ trafficLightHistory });
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    await svc.trafficLightHistory(
      { periodFrom: "2026-04-01", periodTo: "2026-04-30" },
      headA,
    );
    // Same logical input, different property order — should hit the same key.
    await svc.trafficLightHistory(
      { periodTo: "2026-04-30", periodFrom: "2026-04-01" },
      headA,
    );

    expect(trafficLightHistory).toHaveBeenCalledTimes(1);
  });
});

describe("AnalyticsService cache scope partitioning", () => {
  const input = {
    periodFrom: "2026-04-01" as const,
    periodTo: "2026-04-30" as const,
  };

  it("two heads in different groups do not share a cache entry", async () => {
    const trafficLightHistory = vi.fn(() =>
      Promise.resolve({ periods: [], rows: [] }),
    );
    const svc = new AnalyticsService(
      makeRepo({ trafficLightHistory }),
      makeCache().cache,
    );

    await svc.trafficLightHistory(input, headA);
    await svc.trafficLightHistory(input, headB);

    // Different scope discriminators → distinct keys → repository computed twice.
    expect(trafficLightHistory).toHaveBeenCalledTimes(2);
  });

  it("admin and non-admin do not share a cache entry", async () => {
    const leadVelocity = vi.fn(() => Promise.resolve([]));
    const svc = new AnalyticsService(
      makeRepo({ leadVelocity }),
      makeCache().cache,
    );

    await svc.leadVelocity(input, headA);
    await svc.leadVelocity(input, adminSession);

    expect(leadVelocity).toHaveBeenCalledTimes(2);
  });

  it("identical scope and input is a cache hit", async () => {
    const periodComparison = vi.fn(() =>
      Promise.resolve({ periodA: null, periodB: null, rows: [] }),
    );
    const svc = new AnalyticsService(
      makeRepo({ periodComparison }),
      makeCache().cache,
    );
    const sameGroupOtherUser: UserSession = {
      ...headA,
      userId: "a0000000-0000-4000-8000-0000000000a2",
    };

    await svc.periodComparison(
      { periodA: "2026-04-21", periodB: "2026-04-28" },
      headA,
    );
    await svc.periodComparison(
      { periodA: "2026-04-21", periodB: "2026-04-28" },
      sameGroupOtherUser,
    );

    // Same authorised group set → same key → computed once.
    expect(periodComparison).toHaveBeenCalledTimes(1);
  });
});

describe("AnalyticsService.leadVelocity", () => {
  it("returns empty array when repository is empty", async () => {
    const repo = makeRepo();
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);
    const out = await svc.leadVelocity(
      { periodFrom: "2026-04-01", periodTo: "2026-04-30" },
      headA,
    );
    expect(out).toEqual([]);
  });

  it("cache hit short-circuits the repository", async () => {
    const leadVelocity = vi.fn(() => Promise.resolve([]));
    const repo = makeRepo({ leadVelocity });
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    await svc.leadVelocity(
      { periodFrom: "2026-04-01", periodTo: "2026-04-30" },
      headA,
    );
    await svc.leadVelocity(
      { periodFrom: "2026-04-01", periodTo: "2026-04-30" },
      headA,
    );

    expect(leadVelocity).toHaveBeenCalledTimes(1);
  });
});

describe("AnalyticsService.periodComparison", () => {
  it("returns empty rows when repository is empty", async () => {
    const repo = makeRepo();
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);
    const out = await svc.periodComparison(
      { periodA: "2026-04-21", periodB: "2026-04-28" },
      headA,
    );
    expect(out).toEqual({ periodA: null, periodB: null, rows: [] });
  });

  it("cache hit short-circuits the repository", async () => {
    const periodComparison = vi.fn(() =>
      Promise.resolve({ periodA: null, periodB: null, rows: [] }),
    );
    const repo = makeRepo({ periodComparison });
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    await svc.periodComparison(
      { periodA: "2026-04-21", periodB: "2026-04-28" },
      headA,
    );
    await svc.periodComparison(
      { periodA: "2026-04-21", periodB: "2026-04-28" },
      headA,
    );

    expect(periodComparison).toHaveBeenCalledTimes(1);
  });
});

describe("stableHash", () => {
  it("hashes a nested object independent of its key order", () => {
    const a = { periodFrom: "2026-04-01", nested: { x: 1, y: 2 } };
    const b = { nested: { y: 2, x: 1 }, periodFrom: "2026-04-01" };

    expect(stableHash(a)).toBe(stableHash(b));
  });

  it("distinguishes two inputs differing only in a nested value", () => {
    // Nested values are part of the canonical cache-key material, so distinct
    // nested inputs must produce distinct keys.
    const a = { outer: { count: 1 } };
    const b = { outer: { count: 2 } };

    expect(stableHash(a)).not.toBe(stableHash(b));
  });
});

describe("AnalyticsService old nonempty cache shapes", () => {
  const input = { periodFrom: "2026-04-01", periodTo: "2026-04-30" };
  it("recomputes string history periods", async () => {
    const trafficLightHistory = vi.fn(() =>
      Promise.resolve({
        periods: [{ periodStart: "2026-04-01", periodEnd: "2026-04-21" }],
        rows: [],
      }),
    );
    const { cache, store } = makeCache();
    const svc = new AnalyticsService(makeRepo({ trafficLightHistory }), cache);
    await svc.trafficLightHistory(input, headA);
    for (const key of store.keys())
      store.set(key, { periods: ["2026-04-21"], rows: [] });
    expect(await svc.trafficLightHistory(input, headA)).toEqual({
      periods: [{ periodStart: "2026-04-01", periodEnd: "2026-04-21" }],
      rows: [],
    });
    expect(trafficLightHistory).toHaveBeenCalledTimes(2);
  });
  it("recomputes submission labels without a range", async () => {
    const leadVelocity = vi.fn(() =>
      Promise.resolve([
        { periodStart: "2026-04-01", periodEnd: "2026-04-21", leads: [] },
      ]),
    );
    const { cache, store } = makeCache();
    const svc = new AnalyticsService(makeRepo({ leadVelocity }), cache);
    await svc.leadVelocity(input, headA);
    for (const key of store.keys())
      store.set(key, [{ periodLabel: "2026-04-21", leads: [] }]);
    expect(await svc.leadVelocity(input, headA)).toEqual([
      { periodStart: "2026-04-01", periodEnd: "2026-04-21", leads: [] },
    ]);
    expect(leadVelocity).toHaveBeenCalledTimes(2);
  });
  it("recomputes comparison rows without metadata", async () => {
    const periodComparison = vi.fn(() =>
      Promise.resolve({
        periodA: { periodStart: "2026-04-01", periodEnd: "2026-04-21" },
        periodB: null,
        rows: [],
      }),
    );
    const { cache, store } = makeCache();
    const svc = new AnalyticsService(makeRepo({ periodComparison }), cache);
    const pair = { periodA: "2026-04-21", periodB: "2026-04-28" };
    await svc.periodComparison(pair, headA);
    for (const key of store.keys())
      store.set(key, {
        rows: [
          {
            projectId: "11111111-1111-4111-8111-111111111111",
            projectName: "Old",
            statusA: "red",
            statusB: null,
            riskCountA: 1,
            riskCountB: 0,
            riskDelta: -1,
          },
        ],
      });
    expect(await svc.periodComparison(pair, headA)).toEqual({
      periodA: { periodStart: "2026-04-01", periodEnd: "2026-04-21" },
      periodB: null,
      rows: [],
    });
    expect(periodComparison).toHaveBeenCalledTimes(2);
  });
});
