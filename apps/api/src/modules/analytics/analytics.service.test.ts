import { describe, expect, it, vi } from "vitest";
import {
  type AnalyticsCachePort,
  type AnalyticsRepository,
  AnalyticsService,
} from "./analytics.service.js";

function makeCache(): {
  cache: AnalyticsCachePort;
  store: Map<string, unknown>;
} {
  const store = new Map<string, unknown>();
  return {
    store,
    cache: {
      async getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T> {
        if (store.has(key)) return store.get(key) as T;
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
    trafficLightHistory: vi.fn(async () => ({ periods: [], rows: [] })),
    leadVelocity: vi.fn(async () => []),
    periodComparison: vi.fn(async () => ({ rows: [] })),
    ...overrides,
  };
}

describe("AnalyticsService.trafficLightHistory", () => {
  it("returns empty result when repository is empty", async () => {
    const repo = makeRepo();
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    const out = await svc.trafficLightHistory({
      periodFrom: "2026-04-01",
      periodTo: "2026-04-30",
    });

    expect(out).toEqual({ periods: [], rows: [] });
  });

  it("returns multi-project, multi-period grid", async () => {
    const repo = makeRepo({
      trafficLightHistory: vi.fn(async () => ({
        periods: ["2026-04-21", "2026-04-28"],
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
      })),
    });
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    const out = await svc.trafficLightHistory({
      periodFrom: "2026-04-01",
      periodTo: "2026-04-30",
    });

    expect(out.periods).toHaveLength(2);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]?.statuses).toEqual(["green", "red"]);
    expect(out.rows[1]?.statuses).toEqual(["yellow", null]);
  });

  it("cache hit short-circuits the repository on second call", async () => {
    const trafficLightHistory = vi.fn(async () => ({
      periods: ["2026-04-28"],
      rows: [],
    }));
    const repo = makeRepo({ trafficLightHistory });
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    const input = {
      periodFrom: "2026-04-01" as const,
      periodTo: "2026-04-30" as const,
    };
    await svc.trafficLightHistory(input);
    await svc.trafficLightHistory(input);

    expect(trafficLightHistory).toHaveBeenCalledTimes(1);
  });

  it("uses stable cache keys regardless of input property order", async () => {
    const trafficLightHistory = vi.fn(async () => ({ periods: [], rows: [] }));
    const repo = makeRepo({ trafficLightHistory });
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    await svc.trafficLightHistory({
      periodFrom: "2026-04-01",
      periodTo: "2026-04-30",
    });
    // Same logical input, different property order — should hit the same key.
    await svc.trafficLightHistory({
      periodTo: "2026-04-30",
      periodFrom: "2026-04-01",
    });

    expect(trafficLightHistory).toHaveBeenCalledTimes(1);
  });
});

describe("AnalyticsService.leadVelocity", () => {
  it("returns empty array when repository is empty", async () => {
    const repo = makeRepo();
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);
    const out = await svc.leadVelocity({
      periodFrom: "2026-04-01",
      periodTo: "2026-04-30",
    });
    expect(out).toEqual([]);
  });

  it("cache hit short-circuits the repository", async () => {
    const leadVelocity = vi.fn(async () => []);
    const repo = makeRepo({ leadVelocity });
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    await svc.leadVelocity({
      periodFrom: "2026-04-01",
      periodTo: "2026-04-30",
    });
    await svc.leadVelocity({
      periodFrom: "2026-04-01",
      periodTo: "2026-04-30",
    });

    expect(leadVelocity).toHaveBeenCalledTimes(1);
  });
});

describe("AnalyticsService.periodComparison", () => {
  it("returns empty rows when repository is empty", async () => {
    const repo = makeRepo();
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);
    const out = await svc.periodComparison({
      periodA: "2026-04-21",
      periodB: "2026-04-28",
    });
    expect(out).toEqual({ rows: [] });
  });

  it("cache hit short-circuits the repository", async () => {
    const periodComparison = vi.fn(async () => ({ rows: [] }));
    const repo = makeRepo({ periodComparison });
    const { cache } = makeCache();
    const svc = new AnalyticsService(repo, cache);

    await svc.periodComparison({
      periodA: "2026-04-21",
      periodB: "2026-04-28",
    });
    await svc.periodComparison({
      periodA: "2026-04-21",
      periodB: "2026-04-28",
    });

    expect(periodComparison).toHaveBeenCalledTimes(1);
  });
});
