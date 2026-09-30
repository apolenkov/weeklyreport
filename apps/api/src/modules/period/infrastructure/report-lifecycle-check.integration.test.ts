import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
  TEST_IDS,
} from "../../../test-utils/prisma-test-helper";

// `Report_lifecycle_tuple_check` mirrors currentPeriodLifecycleSchema.
const PUBLISHED_AT = new Date("2026-04-14T10:00:00.000Z");

describe("Report lifecycle CHECK constraint (integration)", () => {
  const prisma = createTestPrisma();

  beforeEach(async () => {
    await cleanDatabase();
    await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  // Published rows must also carry a snapshot (Report_published_requires_snapshot).
  const publishedSnapshot = () =>
    publishedSnapshotFixture({
      reportId: TEST_IDS.report,
      periodStart: "2026-04-07",
      periodEnd: "2026-04-13",
      publishedAt: PUBLISHED_AT,
    });

  const update = (data: Parameters<typeof prisma.report.update>[0]["data"]) =>
    prisma.report.update({ where: { id: TEST_IDS.report }, data });

  it("rejects a contradictory tuple", async () => {
    await expect(update({ periodState: "published" })).rejects.toThrow(
      /Report_lifecycle_tuple_check/u,
    );
  });

  it("rejects a published row without a publication timestamp", async () => {
    await expect(
      update({
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedSnapshot: publishedSnapshot(),
      }),
    ).rejects.toThrow(/Report_lifecycle_tuple_check/u);
  });

  it("rejects publication metadata on a draft", async () => {
    await expect(update({ publishedAt: new Date() })).rejects.toThrow(
      /Report_lifecycle_tuple_check/u,
    );
  });

  it("rejects a reopened row without a reopen timestamp", async () => {
    await expect(
      update({
        status: "published",
        periodStatus: "reopened",
        periodState: "open",
        publishedAt: PUBLISHED_AT,
        publishedSnapshot: publishedSnapshot(),
      }),
    ).rejects.toThrow(/Report_lifecycle_tuple_check/u);
  });

  it("accepts a complete published tuple", async () => {
    await expect(
      update({
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: PUBLISHED_AT,
        publishedSnapshot: publishedSnapshot(),
      }),
    ).resolves.toMatchObject({ periodState: "published" });
  });
});
