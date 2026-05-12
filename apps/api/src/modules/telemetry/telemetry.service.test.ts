import { describe, expect, it } from 'vitest';

import {
  NullTelemetryCache,
  TelemetryService,
  type TelemetryCachePort,
  type TelemetryRepository,
} from './telemetry.service.js';

function buildRepo(overrides: Partial<TelemetryRepository> = {}): TelemetryRepository {
  return {
    async reportsThisPeriodCount() {
      return 6;
    },
    async activeLeadsLastPublishedPeriod() {
      return 5;
    },
    async lateSectionsLastPublishedPeriod() {
      return 1;
    },
    async pendingReopenCount() {
      return 0;
    },
    async pdfExportsLast7d() {
      return 12;
    },
    async onTimeRatioPerPeriod() {
      return [0.8, 0.82, 0.85, 0.86];
    },
    ...overrides,
  };
}

describe('TelemetryService — Phase 52-C (UFB-054)', () => {
  it('composes the canonical summary shape from the repository ports', async () => {
    const service = new TelemetryService(buildRepo());
    const summary = await service.getSummary();

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

  it('returns null onTimeRatio when there are no published periods yet', async () => {
    const service = new TelemetryService(
      buildRepo({ async onTimeRatioPerPeriod() { return []; } }),
    );
    const summary = await service.getSummary();
    expect(summary.onTimeRatio).toBeNull();
    expect(summary.sparkline).toEqual([]);
  });

  it('runs through the cache port and only computes once for the same key', async () => {
    let computeCount = 0;
    const repo = buildRepo({
      async reportsThisPeriodCount() {
        computeCount += 1;
        return 6;
      },
    });

    // Capture-and-replay cache: caches the first response and returns
    // it for every subsequent call to the same key.
    const cache: TelemetryCachePort = (() => {
      const store = new Map<string, unknown>();
      return {
        async getOrCompute(key, fn) {
          if (store.has(key)) return store.get(key) as never;
          const value = await fn();
          store.set(key, value);
          return value;
        },
      };
    })();

    const service = new TelemetryService(repo, cache);
    await service.getSummary();
    await service.getSummary();
    await service.getSummary();

    // First call computes; subsequent two are served from cache → only
    // one compute pass observed.
    expect(computeCount).toBe(1);
  });

  it('NullTelemetryCache delegates straight to compute (no caching)', async () => {
    let computeCount = 0;
    const service = new TelemetryService(
      buildRepo({
        async reportsThisPeriodCount() {
          computeCount += 1;
          return 6;
        },
      }),
      new NullTelemetryCache(),
    );

    await service.getSummary();
    await service.getSummary();

    expect(computeCount).toBe(2);
  });

  it('passes the schema validator — rejects out-of-range repo data', async () => {
    const service = new TelemetryService(
      buildRepo({ async onTimeRatioPerPeriod() { return [1.5, 0.5]; } }),
    );

    await expect(service.getSummary()).rejects.toThrow();
  });
});
