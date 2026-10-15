import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createPauseGate } from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { PeriodPrismaRepository } from "../../period/test-seams/index.js";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository.js";
import {
  queryPublishedLineage,
  resetFrozenLineageCache,
} from "./published-lineage.query.js";

// C1665: the lineage reads frozen snapshots and the search projection
// separately. A publication writes both in one transaction, so committing
// between the two reads must still lock its records.
describe("published lineage across a concurrent publication (integration)", () => {
  const prisma = createTestPrisma();
  const periodRepository = new PeriodPrismaRepository(
    prisma as never,
    new WeeklyReportPrismaRepository(prisma as never),
  );

  beforeEach(async () => {
    await cleanDatabase();
    resetFrozenLineageCache();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("locks the records of a publication that commits between the snapshot and projection reads", async () => {
    const testData = await seedTestData(prisma);
    const item = await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "published between lineage reads",
        tag: "general",
        workflowStatus: "in_progress",
        stageNames: ["Development"],
      },
    });
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted" },
    });
    const expected = await periodRepository.getReportById(testData.report.id);
    if (!expected) {
      throw new Error(`fixture report ${testData.report.id} was not found`);
    }
    const snapshotRead = Promise.withResolvers<void>();
    const gate = createPauseGate();
    // Test-side barrier: the published-report read completes first; the
    // projection read waits until the publication below has committed.
    const pausedPrisma = prisma.$extends({
      query: {
        report: {
          async findMany({ args, query }) {
            const rows = await query(args);
            snapshotRead.resolve();
            return rows;
          },
        },
        publishedSearchDocument: {
          async findMany({ args, query }) {
            await snapshotRead.promise;
            await gate.pause();
            return query(args);
          },
        },
      },
    });

    const lineage = queryPublishedLineage(
      pausedPrisma as unknown as typeof prisma,
      {
        reportId: "99999999-9999-4999-8999-999999999991",
        reportSectionId: "99999999-9999-4999-8999-999999999992",
        itemStableIds: [item.stableId],
        decisionStableIds: [],
      },
    );
    await gate.paused;
    try {
      const publication = await periodRepository.publishPeriod(
        testData.report.id,
        testData.head.id,
        expected,
      );
      expect(publication.transitioned).toBe(true);
    } finally {
      gate.release();
    }

    await expect(lineage).resolves.toMatchObject({
      itemStableIds: [item.stableId],
    });
  });
});
