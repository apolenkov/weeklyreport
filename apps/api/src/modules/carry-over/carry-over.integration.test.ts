import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { CarryOverPrismaRepository } from "./carry-over.prisma-repository";

describe("CarryOverPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: CarryOverPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new CarryOverPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("findExecutionByDedupeKey returns null when not found", async () => {
    const result = await repo.findExecutionByDedupeKey("nonexistent-key");
    expect(result).toBeNull();
  });

  it("saveCarryOver creates execution and records atomically", async () => {
    // Create a target report and section for carry-over
    const targetReport = await prisma.report.create({
      data: {
        id: TEST_IDS.targetReport,
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
      },
    });

    const targetSection = await prisma.reportSection.create({
      data: {
        reportId: targetReport.id,
        authorId: testData.lead.id,
        status: "draft",
      },
    });

    // Create a source item to carry over
    const sourceItem = await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "next",
        text: "Carry this over",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
      },
    });

    const dedupeKey = `${testData.report.id}->${targetReport.id}`;

    const execution = {
      id: TEST_IDS.carryExec,
      sourceReportId: testData.report.id,
      targetReportId: targetReport.id,
      dedupeKey,
      status: "completed" as const,
      startedAt: new Date(),
      completedAt: new Date(),
      carriedItemCount: 1,
      carriedDecisionCount: 0,
    };

    const records = [
      {
        id: TEST_IDS.carryRecord,
        sourceReportId: testData.report.id,
        targetReportId: targetReport.id,
        sourceItemId: sourceItem.id,
        targetItemId: TEST_IDS.carryTargetItem,
        sourceDecisionId: null,
        targetDecisionId: null,
        status: "completed" as const,
        carriedAt: new Date(),
      },
    ];

    const targetSectionReadModel = {
      reportSectionId: targetSection.id,
      reportId: targetReport.id,
      authorId: testData.lead.id,
      authorName: "Test Lead 1",
      status: "draft" as const,
      submittedAt: null,
      projects: [],
      items: [
        {
          id: TEST_IDS.carryTargetItem,
          projectId: testData.project.id,
          type: "current" as const,
          text: "Carry this over",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
          completed: null,
        },
      ],
      risks: [],
      decisions: [],
      priorities: [],
    };

    const result = await repo.saveCarryOver(
      execution,
      records,
      targetSectionReadModel,
    );

    expect(result.execution.id).toBe(TEST_IDS.carryExec);
    expect(result.records).toHaveLength(1);

    // Verify execution was persisted
    const found = await repo.findExecutionByDedupeKey(dedupeKey);
    expect(found).not.toBeNull();
    expect(expectDefined(found).id).toBe(TEST_IDS.carryExec);
    expect(expectDefined(found).status).toBe("completed");
    expect(expectDefined(found).carriedItemCount).toBe(1);

    // Verify item was created in target section
    const targetItems = await prisma.item.findMany({
      where: { reportSectionId: targetSection.id },
    });
    expect(targetItems).toHaveLength(1);
    expect(expectDefined(targetItems[0]).carriedOver).toBe(true);
    expect(expectDefined(targetItems[0]).text).toBe("Carry this over");
  });
});
