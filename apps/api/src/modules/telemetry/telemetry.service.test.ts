import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { scopeDiscriminator } from "../../lib/group-scope.js";
import {
  type TelemetryCachePort,
  type TelemetryRepository,
  TelemetryService,
} from "./telemetry.service.js";

class NullTelemetryCache implements TelemetryCachePort {
  readonly getOrCompute = async <T>(
    _key: string,
    fn: () => Promise<T>,
  ): Promise<T> => fn();
}

const GROUP_A = "a0000000-0000-4000-a000-000000000001";
const GROUP_B = "b0000000-0000-4000-a000-000000000001";

function makeHeadSession(groupId: string, userId: string): UserSession {
  return {
    userId,
    email: `${userId}@test.local`,
    name: `Head ${groupId}`,
    role: "head",
    activeReportId: null,
    activeReportSectionId: null,
    reportingGroupId: groupId,
  };
}

const headA = makeHeadSession(GROUP_A, "a0000000-0000-4000-a000-000000000002");
const headB = makeHeadSession(GROUP_B, "b0000000-0000-4000-a000-000000000002");

function buildRepo(
  overrides: Partial<TelemetryRepository> = {},
): TelemetryRepository {
  return {
    reportsThisPeriodCount: () => Promise.resolve(6),
    activeLeadsLastPublishedPeriod: () => Promise.resolve(5),
    lateSectionsLastPublishedPeriod: () => Promise.resolve(1),
    pendingReopenCount: () => Promise.resolve(0),
    pdfExportsLast7d: () => Promise.resolve(12),
    onTimeRatioPerPeriod: () => Promise.resolve([0.8, 0.82, 0.85, 0.86]),
    ...overrides,
  };
}

describe("TelemetryService", () => {
  it("composes the canonical summary shape from the repository ports", async () => {
    const service = new TelemetryService(buildRepo(), new NullTelemetryCache());
    const summary = await service.getSummary(headA);

    expect(summary).toEqual({
      reportsThisPeriod: 6,
      onTimeRatio: 0.86,
      activeLeads: 5,
      lateSections: 1,
      pendingReopens: 0,
      pdfExportsLast7d: 12,
      sparkline: [0.8, 0.82, 0.85, 0.86],
    });
  });

  it("returns null onTimeRatio when there are no published periods yet", async () => {
    const service = new TelemetryService(
      buildRepo({
        onTimeRatioPerPeriod: () => Promise.resolve([]),
      }),
      new NullTelemetryCache(),
    );
    const summary = await service.getSummary(headA);
    expect(summary.onTimeRatio).toBeNull();
    expect(summary.sparkline).toEqual([]);
  });

  it("passes the caller session to every repository method", async () => {
    const repo = {
      reportsThisPeriodCount: vi.fn(() => Promise.resolve(6)),
      activeLeadsLastPublishedPeriod: vi.fn(() => Promise.resolve(5)),
      lateSectionsLastPublishedPeriod: vi.fn(() => Promise.resolve(1)),
      pendingReopenCount: vi.fn(() => Promise.resolve(0)),
      pdfExportsLast7d: vi.fn(() => Promise.resolve(12)),
      onTimeRatioPerPeriod: vi.fn(() =>
        Promise.resolve([0.8, 0.82, 0.85, 0.86]),
      ),
    } satisfies TelemetryRepository;

    await new TelemetryService(repo, new NullTelemetryCache()).getSummary(
      headA,
    );

    expect(repo.reportsThisPeriodCount).toHaveBeenCalledWith(headA);
    expect(repo.activeLeadsLastPublishedPeriod).toHaveBeenCalledWith(headA);
    expect(repo.lateSectionsLastPublishedPeriod).toHaveBeenCalledWith(headA);
    expect(repo.pendingReopenCount).toHaveBeenCalledWith(headA);
    expect(repo.pdfExportsLast7d).toHaveBeenCalledWith(headA);
    expect(repo.onTimeRatioPerPeriod).toHaveBeenCalledWith(4, headA);
  });

  it("caches each group scope under a distinct key", async () => {
    const reportsThisPeriodCount = vi.fn(() => Promise.resolve(6));
    const repo = buildRepo({
      reportsThisPeriodCount,
    });

    // Capture-and-replay cache: caches the first response and returns
    // it for every subsequent call in the same scope partition.
    const requestedKeys = new Set<string>();
    const cache: TelemetryCachePort = (() => {
      const store = new Map<string, unknown>();
      return {
        async getOrCompute(key, fn) {
          requestedKeys.add(key);
          if (store.has(key)) return store.get(key) as never;
          const value = await fn();
          store.set(key, value);
          return value;
        },
      };
    })();

    const service = new TelemetryService(repo, cache);
    await service.getSummary(headA);
    await service.getSummary(headA);
    await service.getSummary(headB);
    await service.getSummary(headB);

    expect(reportsThisPeriodCount).toHaveBeenCalledTimes(2);
    expect(requestedKeys.size).toBe(2);
    expect([...requestedKeys]).toEqual(
      expect.arrayContaining([
        `summary:v1:${scopeDiscriminator(headA)}`,
        `summary:v1:${scopeDiscriminator(headB)}`,
      ]),
    );
  });

  it("passes the schema validator — rejects out-of-range repo data", async () => {
    const service = new TelemetryService(
      buildRepo({
        onTimeRatioPerPeriod: () => Promise.resolve([1.5, 0.5]),
      }),
      new NullTelemetryCache(),
    );

    await expect(service.getSummary(headA)).rejects.toThrow();
  });
});
