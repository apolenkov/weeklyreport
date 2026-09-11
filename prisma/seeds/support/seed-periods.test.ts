import { afterEach, describe, expect, it, vi } from "vitest";

async function loadPeriodProfiles(referenceDate: string) {
  vi.stubEnv("SEED_REFERENCE_DATE", referenceDate);
  vi.resetModules();
  const [simple, support] = await Promise.all([
    import("../simple/seed-simple.period.js"),
    import("./seed-periods.js"),
  ]);
  return { simple, support };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("seed reporting-period UTC boundaries", () => {
  it("keeps simple and full profiles on identical pinned boundaries", async () => {
    const { simple, support } = await loadPeriodProfiles(
      "2026-09-02T12:00:00Z",
    );

    expect(simple.ACTIVE_MONDAY.toISOString()).toBe(
      support.SEED_REPORTS.active.periodStart,
    );
    expect(simple.ACTIVE_SUNDAY.toISOString()).toBe(
      support.SEED_REPORTS.active.periodEnd,
    );
    expect(simple.ACTIVE_FRIDAY_DEADLINE.toISOString()).toBe(
      support.SEED_REPORTS.active.deadline,
    );
    expect(simple.PREV_MONDAY.toISOString()).toBe(
      support.SEED_REPORTS.published.periodStart,
    );
    expect(simple.PREV_SUNDAY.toISOString()).toBe(
      support.SEED_REPORTS.published.periodEnd,
    );
    expect(simple.PREV_FRIDAY_DEADLINE.toISOString()).toBe(
      support.SEED_REPORTS.published.deadline,
    );
    expect(support.SEED_REPORTS.active.weekLabel).toBe(
      `Week ${simple.isoWeekNumber(simple.ACTIVE_MONDAY)}`,
    );
  });

  it("uses inclusive millisecond precision for every full-profile period", async () => {
    const { support } = await loadPeriodProfiles("2026-09-02T12:00:00Z");
    const periods = [
      ...Object.values(support.SEED_REPORTS),
      ...support.SEED_HISTORY_REPORTS,
    ];

    for (const { periodEnd } of periods) {
      expect(periodEnd).toMatch(/T23:59:59\.999Z$/u);
    }
  });

  it.each([
    {
      referenceDate: "2021-01-01T12:00:00Z",
      monday: "2020-12-28T00:00:00.000Z",
      weekNumber: 53,
    },
    {
      referenceDate: "2021-01-04T12:00:00Z",
      monday: "2021-01-04T00:00:00.000Z",
      weekNumber: 1,
    },
  ])(
    "aligns both profiles across the ISO-year transition at $referenceDate",
    async ({ referenceDate, monday, weekNumber }) => {
      const { simple, support } = await loadPeriodProfiles(referenceDate);

      expect(simple.ACTIVE_MONDAY.toISOString()).toBe(monday);
      expect(support.SEED_REPORTS.active.periodStart).toBe(monday);
      expect(simple.isoWeekNumber(simple.ACTIVE_MONDAY)).toBe(weekNumber);
      expect(support.SEED_REPORTS.active.weekLabel).toBe(`Week ${weekNumber}`);
      expect(simple.ACTIVE_FRIDAY_DEADLINE.getUTCHours()).toBe(15);
      expect(simple.ACTIVE_SUNDAY.getUTCMilliseconds()).toBe(999);
    },
  );
});
