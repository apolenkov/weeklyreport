import type { Prisma, PrismaClient } from "@prisma/client";
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
  it("keeps one published report per week when full extends the simple seed", async () => {
    await loadPeriodProfiles("2026-09-02T12:00:00Z");
    const [{ seedReports }, { seedHistoryPeriods }] = await Promise.all([
      import("../simple/seed-simple.reports.js"),
      import("../advanced/seed-advanced.history.js"),
    ]);
    const reports = new Map<string, Prisma.ReportCreateManyInput>();
    const storeReport = (data: Prisma.ReportCreateManyInput) => {
      if (!data.id) throw new Error("Seed report requires a deterministic id");
      reports.set(data.id, data);
    };
    const ignoredUpsert = () => Promise.resolve({});
    const prisma = {
      report: {
        createMany: ({ data }: { data: Prisma.ReportCreateManyInput[] }) => {
          for (const report of data) storeReport(report);
          return Promise.resolve({ count: data.length });
        },
        upsert: (args: {
          where: { id: string };
          create: Prisma.ReportCreateManyInput;
          update: Partial<Prisma.ReportCreateManyInput>;
        }) => {
          const stored = reports.get(args.where.id);
          storeReport(stored ? { ...stored, ...args.update } : args.create);
          return Promise.resolve(reports.get(args.where.id));
        },
      },
      reportSection: { upsert: ignoredUpsert },
      projectStatus: { upsert: ignoredUpsert },
      item: { upsert: ignoredUpsert },
    } as unknown as PrismaClient;
    const publishedStarts = () =>
      [...reports.values()]
        .filter(({ status }) => status === "published")
        .map(({ periodStart }) => new Date(periodStart).toISOString())
        .sort();
    const expected = [
      "2026-07-27T00:00:00.000Z",
      "2026-08-03T00:00:00.000Z",
      "2026-08-10T00:00:00.000Z",
      "2026-08-17T00:00:00.000Z",
      "2026-08-24T00:00:00.000Z",
    ];

    await seedReports(prisma);
    expect(publishedStarts()).toEqual(expected);
    await seedHistoryPeriods(prisma);
    expect(publishedStarts()).toEqual(expected);
    expect(reports.size).toBe(8);
  });

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
