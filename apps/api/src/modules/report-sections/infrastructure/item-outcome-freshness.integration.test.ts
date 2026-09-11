import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import { LeadFormConstraintError } from "../domain/lead-form-shared";
import {
  assignOutcomeStage,
  createOutcomePeriod,
  outcomeCommand,
  publishReportFixture,
  seedOutcomeItem,
  seedPriorPlan,
} from "./item-outcome.integration.fixtures";
import { resolvePlanTx } from "./item-outcome.transaction";

const STALE_SOURCE_MESSAGE =
  "This plan has a newer historical occurrence. Reload the report.";

describe("item outcome source freshness (real database)", () => {
  const prisma = createTestPrisma();
  const prismaService = prisma as unknown as PrismaService;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    await assignOutcomeStage(prisma, testData);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  async function seedNewerTerminal(
    stableId: string,
    sourceKind: "submitted" | "published",
  ) {
    const item = await seedOutcomeItem(prisma, {
      sectionId: testData.section.id,
      projectId: testData.project.id,
      stableId,
      type: "current",
      workflowStatus: "done",
      text: "Latest terminal result",
    });
    if (sourceKind === "published") {
      await publishReportFixture(prisma, {
        reportId: testData.report.id,
        sectionId: testData.section.id,
        authorId: testData.lead.id,
        groupId: expectDefined(testData.lead.reportingGroupId),
      });
    } else {
      await prisma.reportSection.update({
        where: { id: testData.section.id },
        data: {
          status: "submitted",
          submittedAt: new Date("2026-04-13T18:00:00.000Z"),
        },
      });
    }
    return item;
  }

  it.each(["submitted", "published"] as const)(
    "rejects an older source shadowed by a newer %s terminal without residue",
    async (newerKind) => {
      const older = await seedPriorPlan(prisma, testData);
      await seedNewerTerminal(older.item.stableId, newerKind);
      const target = await createOutcomePeriod(prisma, testData, 1);
      const input = outcomeCommand(
        target.section.id,
        {
          kind: "prior",
          reportId: older.report.id,
          recordId: older.item.id,
        },
        "done",
      );

      const failure = resolvePlanTx(prismaService, input, testData.lead.id);
      await expect(failure).rejects.toBeInstanceOf(LeadFormConstraintError);
      await expect(failure).rejects.toThrow(STALE_SOURCE_MESSAGE);

      await expect(
        prisma.reportSection.findUniqueOrThrow({
          where: { id: target.section.id },
          select: { version: true },
        }),
      ).resolves.toEqual({ version: 1 });
      await expect(
        prisma.item.count({ where: { reportSectionId: target.section.id } }),
      ).resolves.toBe(0);
      await expect(
        prisma.itemOutcomeEvent.count({
          where: { reportSectionId: target.section.id },
        }),
      ).resolves.toBe(0);
    },
  );

  it("allows Plan next from the latest terminal occurrence and preserves both prior snapshots", async () => {
    const older = await seedPriorPlan(prisma, testData);
    const latest = await seedNewerTerminal(older.item.stableId, "published");
    const latestSnapshot = expectDefined(
      (
        await prisma.report.findUniqueOrThrow({
          where: { id: testData.report.id },
          select: { publishedSnapshot: true },
        })
      ).publishedSnapshot,
    );
    const target = await createOutcomePeriod(prisma, testData, 1);

    const result = await resolvePlanTx(
      prismaService,
      outcomeCommand(
        target.section.id,
        {
          kind: "prior",
          reportId: testData.report.id,
          recordId: latest.id,
        },
        "plan_next",
      ),
      testData.lead.id,
    );

    expect(result).toMatchObject({
      stableId: older.item.stableId,
      replayed: false,
      section: {
        version: 2,
        items: [
          {
            stableId: older.item.stableId,
            type: "next",
            workflowStatus: "planned",
          },
        ],
      },
    });
    await expect(
      prisma.itemOutcomeEvent.count({
        where: { reportSectionId: target.section.id },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.report.findMany({
        where: { id: { in: [older.report.id, testData.report.id] } },
        orderBy: { periodStart: "asc" },
        select: { publishedSnapshot: true },
      }),
    ).resolves.toEqual([
      { publishedSnapshot: older.snapshot },
      { publishedSnapshot: latestSnapshot },
    ]);
  });
});
