import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type AnalyticsCachePort,
  type AnalyticsRepository,
  AnalyticsService,
} from "./analytics.service.js";

/**
 * ANAL-02/03 (Phase 30-02) TZ-stability gate.
 *
 * The Prisma repository formats period labels via
 * `Date.prototype.toISOString().slice(0, 10)`. Because `toISOString` always
 * returns UTC, the labels MUST be byte-identical regardless of
 * `process.env.TZ`. This test flips TZ between Europe/Moscow and UTC and
 * asserts the service produces identical labels for the same fixture.
 *
 * The fakeRepo below returns pre-computed labels — that is intentional. The
 * real defense lives in analytics.prisma-repository.ts where the format
 * function is fixed at compile time. This test asserts the service-level
 * contract: AnalyticsService does not re-format labels through any
 * TZ-sensitive path.
 */

const fixedHistory = {
  periods: ["2026-04-21", "2026-04-28"],
  rows: [
    {
      projectId: "11111111-1111-4111-8111-111111111111",
      projectName: "P",
      statuses: ["green" as const, "red" as const],
    },
  ],
};

const fixedVelocity = [
  { periodLabel: "2026-04-21", leads: [] },
  { periodLabel: "2026-04-28", leads: [] },
];

const fixedComparison = { rows: [] };

function fakeRepo(): AnalyticsRepository {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AnalyticsRepository port (no awaitable work in the stub)
    async trafficLightHistory() {
      return fixedHistory;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AnalyticsRepository port (no awaitable work in the stub)
    async leadVelocity() {
      return fixedVelocity;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AnalyticsRepository port (no awaitable work in the stub)
    async periodComparison() {
      return fixedComparison;
    },
  };
}

function noopCache(): AnalyticsCachePort {
  return {
    async getOrCompute<T>(_k: string, fn: () => Promise<T>) {
      return fn();
    },
  };
}

describe("Analytics labels are TZ-stable @ANAL-02 @ANAL-03", () => {
  let originalTZ: string | undefined;

  beforeEach(() => {
    originalTZ = process.env.TZ;
  });

  afterEach(() => {
    if (originalTZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTZ;
    }
  });

  it("produces identical labels under Europe/Moscow and UTC", async () => {
    const svc = new AnalyticsService(fakeRepo(), noopCache());
    const inputs = { periodFrom: "2026-04-01", periodTo: "2026-04-30" };

    process.env.TZ = "Europe/Moscow";
    const moscowHistory = await svc.trafficLightHistory(inputs);
    const moscowVelocity = await svc.leadVelocity(inputs);

    process.env.TZ = "UTC";
    const utcHistory = await svc.trafficLightHistory(inputs);
    const utcVelocity = await svc.leadVelocity(inputs);

    expect(moscowHistory.periods.join("|")).toBe(utcHistory.periods.join("|"));
    expect(moscowVelocity.map((r) => r.periodLabel)).toEqual(
      utcVelocity.map((r) => r.periodLabel),
    );
  });

  it("Date.toISOString().slice(0,10) is itself TZ-stable", () => {
    // Belt-and-suspenders sanity check on the underlying primitive used by
    // analytics.prisma-repository.ts. If this assertion ever fails, the
    // Node runtime semantics changed — escalate.
    const sample = new Date("2026-04-28T23:30:00.000Z");

    process.env.TZ = "Europe/Moscow";
    const moscowLabel = sample.toISOString().slice(0, 10);

    process.env.TZ = "UTC";
    const utcLabel = sample.toISOString().slice(0, 10);

    expect(moscowLabel).toBe(utcLabel);
    expect(moscowLabel).toBe("2026-04-28");
  });
});
