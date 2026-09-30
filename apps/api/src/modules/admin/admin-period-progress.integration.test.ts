import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { listPeriodsByState } from "./admin-period.queries";

// Admin Periods must report the same progress as the weekly read model
// (`weekly-progress-denominator`): leads, not section rows.
describe("listPeriodsByState progress (integration)", () => {
  const prisma = createTestPrisma();
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  const listOnly = async (state: "open" | "published") => {
    const [row] = await listPeriodsByState(prisma as never, {
      states: [state],
      limit: 10,
    });
    return row;
  };

  it("counts expected active leads, not section rows", async () => {
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted" },
    });
    await prisma.user.createMany({
      data: [
        {
          email: "lead2@test.local",
          name: "Lead 2",
          lastName: "Two",
          firstName: "Lead",
          role: "lead",
          samlId: "lead-test-2",
        },
        {
          email: "gone@test.local",
          name: "Gone",
          lastName: "Gone",
          firstName: "Lead",
          role: "lead",
          samlId: "lead-gone",
          isActive: false,
        },
      ],
    });
    const gone = await prisma.user.findUniqueOrThrow({
      where: { email: "gone@test.local" },
    });
    await prisma.reportSection.create({
      data: {
        reportId: testData.report.id,
        authorId: gone.id,
        status: "submitted",
      },
    });

    const row = await listOnly("open");

    expect(row).toMatchObject({ submittedCount: 1, totalCount: 2 });
  });

  it("uses the frozen snapshot authors for a published period", async () => {
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted" },
    });
    const publishedAt = new Date("2026-04-14T10:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          publishedAt,
          sectionOwners: [
            {
              reportSectionId: testData.section.id,
              authorId: TEST_IDS.lead,
              authorName: "Test Lead 1",
              groupId: TEST_IDS.group,
              groupName: "Test Group",
            },
          ],
        }),
      },
    });

    const row = await listOnly("published");

    expect(row).toMatchObject({ submittedCount: 1, totalCount: 1 });
  });
});
