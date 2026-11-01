import {
  type AdminReportPeriod,
  publishedReportSnapshotSchema,
} from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "./admin.prisma-repository";

// Restore is the only writer that reaches published rows without the live
// tsrange exclusion, so the period-order guard lives on the restore input
// (adminSnapshotRestoreSchema), not on the shared read schemas. These tests
// pin both halves: restore must reject an inverted envelope at the
// application boundary before any write, while a stored inverted publication
// must stay exportable (recovery is the only path that can repair it).
describe("admin snapshot period order (integration)", () => {
  const NEW_PERIOD_ID = "a0000000-0000-4000-a000-000000000070";
  const ONE_DAY_PERIOD_ID = "a0000000-0000-4000-a000-000000000071";
  const PUBLISHED_AT = new Date("2026-08-30T10:00:00.000Z");
  const INVERTED_START = new Date("2026-08-30T00:00:00.000Z");
  const INVERTED_END = new Date("2026-08-24T00:00:00.000Z");

  const prisma = createTestPrisma();
  const repo = new AdminPrismaRepository(prisma as never);
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it.each(["published", "open draft"] as const)(
    "rejects an inverted %s period on restore before any write",
    async (lifecycle) => {
      const before = await repo.getSnapshot();
      const invertedPeriod: AdminReportPeriod =
        lifecycle === "published"
          ? {
              id: NEW_PERIOD_ID,
              periodStart: INVERTED_START,
              periodEnd: INVERTED_END,
              deadline: null,
              weekLabel: null,
              status: "published",
              periodState: "published",
              periodStatus: "published",
              archived: false,
              autoPublished: false,
              autoArchived: false,
              publishedAt: PUBLISHED_AT,
              publishedById: null,
              reopenedAt: null,
              publishedSnapshot: publishedReportSnapshotSchema.parse(
                publishedSnapshotFixture({
                  reportId: NEW_PERIOD_ID,
                  periodStart: INVERTED_START,
                  periodEnd: INVERTED_END,
                  publishedAt: PUBLISHED_AT,
                }),
              ),
            }
          : {
              id: NEW_PERIOD_ID,
              periodStart: INVERTED_START,
              periodEnd: INVERTED_END,
              deadline: null,
              weekLabel: null,
              status: "draft",
              periodState: "open",
              periodStatus: "open",
              archived: false,
              autoPublished: false,
              autoArchived: false,
              publishedAt: null,
              publishedById: null,
              reopenedAt: null,
              publishedSnapshot: null,
            };

      // A raw ZodError (not a mapped conflict or a DB error) proves the
      // rejection happens at the restore boundary, before the transaction.
      await expect(
        repo.saveSnapshot({
          ...before,
          periods: [...before.periods, invertedPeriod],
        }),
      ).rejects.toBeInstanceOf(ZodError);
      expect(
        await prisma.report.findUnique({ where: { id: NEW_PERIOD_ID } }),
      ).toBeNull();
      // The seeded draft survives untouched and the export is unchanged.
      expect(
        await prisma.report.findUnique({ where: { id: testData.report.id } }),
      ).toMatchObject({ status: "draft" });
      await expect(repo.getSnapshot()).resolves.toEqual(before);
    },
  );

  it("restores a one-day published period with equal start and end", async () => {
    const before = await repo.getSnapshot();
    const day = new Date("2026-08-30T00:00:00.000Z");
    const oneDayPeriod: AdminReportPeriod = {
      id: ONE_DAY_PERIOD_ID,
      periodStart: day,
      periodEnd: day,
      deadline: null,
      weekLabel: null,
      status: "published",
      periodState: "published",
      periodStatus: "published",
      archived: false,
      autoPublished: false,
      autoArchived: false,
      publishedAt: PUBLISHED_AT,
      publishedById: null,
      reopenedAt: null,
      publishedSnapshot: publishedReportSnapshotSchema.parse(
        publishedSnapshotFixture({
          reportId: ONE_DAY_PERIOD_ID,
          periodStart: day,
          periodEnd: day,
          publishedAt: PUBLISHED_AT,
        }),
      ),
    };

    await repo.saveSnapshot({
      ...before,
      periods: [...before.periods, oneDayPeriod],
    });

    const row = expectDefined(
      await prisma.report.findUnique({ where: { id: ONE_DAY_PERIOD_ID } }),
    );
    expect(row.periodStart.getTime()).toBe(row.periodEnd.getTime());
    const exported = expectDefined(
      (await repo.getSnapshot()).periods.find(
        ({ id }) => id === ONE_DAY_PERIOD_ID,
      ),
    );
    expect(exported.periodStart.getTime()).toBe(exported.periodEnd.getTime());
  });

  it("exports a stored inverted publication unchanged", async () => {
    // A live inverted published row is legal for the DB: the tsrange
    // exclusion only covers open/scheduled periods, so this data can exist
    // (e.g. written before the guard) and must stay readable.
    await prisma.report.create({
      data: {
        id: NEW_PERIOD_ID,
        periodStart: INVERTED_START,
        periodEnd: INVERTED_END,
        deadline: null,
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt: PUBLISHED_AT,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: NEW_PERIOD_ID,
          periodStart: INVERTED_START,
          periodEnd: INVERTED_END,
          publishedAt: PUBLISHED_AT,
        }),
      },
    });

    const snapshot = await repo.getSnapshot();
    const exported = expectDefined(
      snapshot.periods.find(({ id }) => id === NEW_PERIOD_ID),
    );
    expect(exported.periodStart.getTime()).toBeGreaterThan(
      exported.periodEnd.getTime(),
    );
    const storedSnapshot = expectDefined(exported.publishedSnapshot);
    expect(storedSnapshot.periodEnd.getTime()).toBeLessThan(
      storedSnapshot.periodStart.getTime(),
    );
  });
});
