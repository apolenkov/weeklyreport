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
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
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
        workflowStatus: "planned",
        carriedOver: false,
        stageNames: ["Development"],
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
      authorRole: "lead" as const,
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      late: false,
      projects: [],
      referencedProjects: [],
      items: [
        {
          id: TEST_IDS.carryTargetItem,
          stableId: sourceItem.stableId,
          projectId: testData.project.id,
          type: "current" as const,
          text: "Carry this over",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
          stageNames: ["Development"],
        },
      ],
      risks: [],
      decisions: [],
      priorities: [],
      activities: [],
      reviews: [],
    };

    const result = await repo.saveCarryOver(execution, records, [
      targetSectionReadModel,
    ]);

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

  it("persists an item recordType when sourceItemId is null", async () => {
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
    const dedupeKey = `${testData.report.id}:${targetReport.id}`;
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
        sourceItemId: null,
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
      authorRole: "lead" as const,
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      late: false,
      projects: [],
      referencedProjects: [],
      items: [
        {
          id: TEST_IDS.carryTargetItem,
          stableId: crypto.randomUUID(),
          projectId: testData.project.id,
          type: "current" as const,
          text: "Item with no source id",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
          stageNames: ["Development"],
        },
      ],
      risks: [],
      decisions: [],
      priorities: [],
      activities: [],
      reviews: [],
    };

    await repo.saveCarryOver(execution, records, [targetSectionReadModel]);

    await expect(
      prisma.carryOverRecord.findUnique({
        where: { id: TEST_IDS.carryRecord },
        select: { recordType: true },
      }),
    ).resolves.toEqual({ recordType: "item" });
    await expect(
      repo.findExecutionByDedupeKey(dedupeKey),
    ).resolves.toMatchObject({
      carriedItemCount: 1,
      carriedDecisionCount: 0,
    });
  });

  // saveCarryOver must persist the source record's stableId onto the clone so
  // a carried позиция shares one lineage key with its origin, while the clone
  // still gets its own PK id.
  it("saveCarryOver persists the carried clone's stableId, distinct from its fresh PK", async () => {
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

    // The lineage key the clone inherits from its source (cloneCarriedItem
    // copies it via the `...item` spread; here we assert the repo persists it).
    const sourceStableId = "a0000000-0000-4000-a000-0000000005aa";
    const execution = {
      id: TEST_IDS.carryExec,
      sourceReportId: testData.report.id,
      targetReportId: targetReport.id,
      dedupeKey: `${testData.report.id}:${targetReport.id}`,
      status: "completed" as const,
      startedAt: new Date(),
      completedAt: new Date(),
      carriedItemCount: 1,
      carriedDecisionCount: 0,
    };
    const targetSectionReadModel = {
      reportSectionId: targetSection.id,
      reportId: targetReport.id,
      authorId: testData.lead.id,
      authorName: "Test Lead 1",
      authorRole: "lead" as const,
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      late: false,
      projects: [],
      referencedProjects: [],
      items: [
        {
          id: TEST_IDS.carryTargetItem, // fresh PK minted by the clone
          stableId: sourceStableId, // lineage key copied from the source
          projectId: testData.project.id,
          type: "current" as const,
          text: "Carried with lineage",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
          stageNames: ["Development"],
        },
      ],
      risks: [],
      decisions: [],
      priorities: [],
      activities: [],
      reviews: [],
    };

    await repo.saveCarryOver(
      execution,
      [
        {
          id: TEST_IDS.carryRecord,
          sourceReportId: testData.report.id,
          targetReportId: targetReport.id,
          sourceItemId: null,
          targetItemId: TEST_IDS.carryTargetItem,
          sourceDecisionId: null,
          targetDecisionId: null,
          status: "completed",
          carriedAt: new Date(),
        },
      ],
      [targetSectionReadModel],
    );

    const persisted = expectDefined(
      (
        await prisma.item.findMany({
          where: { reportSectionId: targetSection.id },
        })
      )[0],
    );
    // The clone shares the source lineage key...
    expect(persisted.stableId).toBe(sourceStableId);
    // ...but carries its own PK, distinct from the lineage key.
    expect(persisted.id).toBe(TEST_IDS.carryTargetItem);
    expect(persisted.stableId).not.toBe(persisted.id);
  });

  it("carries an unresolved decision with product + stageNames without aborting", async () => {
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

    const decisionId = crypto.randomUUID();
    const execution = {
      id: crypto.randomUUID(),
      sourceReportId: testData.report.id,
      targetReportId: targetReport.id,
      dedupeKey: `${testData.report.id}:${targetReport.id}`,
      status: "completed" as const,
      startedAt: new Date(),
      completedAt: new Date(),
      carriedItemCount: 0,
      carriedDecisionCount: 1,
    };
    const records = [
      {
        id: crypto.randomUUID(),
        sourceReportId: testData.report.id,
        targetReportId: targetReport.id,
        sourceItemId: null,
        targetItemId: null,
        sourceDecisionId: crypto.randomUUID(),
        targetDecisionId: decisionId,
        status: "completed" as const,
        carriedAt: new Date(),
      },
    ];
    const targetSectionReadModel = {
      reportSectionId: targetSection.id,
      reportId: targetReport.id,
      authorId: testData.lead.id,
      authorName: "Test Lead 1",
      authorRole: "lead" as const,
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      late: false,
      projects: [],
      referencedProjects: [],
      items: [],
      risks: [],
      decisions: [
        {
          id: decisionId,
          text: "Unresolved decision with product",
          owner: "Test Head",
          deadline: null,
          impact: "Needs escalation",
          resolvedAt: null,
          stageNames: ["Development", "Design"],
          productId: testData.project.id,
        },
      ],
      activities: [],
      reviews: [],
    };

    // Product-parented carried decisions persist their stageNames in the same
    // transaction as the rest of the carry-over.
    await repo.saveCarryOver(execution, records, [targetSectionReadModel]);

    const created = await prisma.decision.findMany({
      where: { reportSectionId: targetSection.id },
    });
    expect(created).toHaveLength(1);
    expect(expectDefined(created[0]).stageNames).toEqual([
      "Development",
      "Design",
    ]);
    expect(expectDefined(created[0]).productId).toBe(testData.project.id);

    // Counts never exceed persisted: the decision CarryOverRecord count equals
    // the number of Decision rows actually written.
    const decisionRecords = await prisma.carryOverRecord.findMany({
      where: { executionId: execution.id, recordType: "decision" },
    });
    expect(decisionRecords).toHaveLength(created.length);
  });

  it("carries an item's priorityRank and stageNames across the boundary", async () => {
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

    const itemId = crypto.randomUUID();
    const execution = {
      id: crypto.randomUUID(),
      sourceReportId: testData.report.id,
      targetReportId: targetReport.id,
      dedupeKey: `${testData.report.id}:${targetReport.id}`,
      status: "completed" as const,
      startedAt: new Date(),
      completedAt: new Date(),
      carriedItemCount: 1,
      carriedDecisionCount: 0,
    };
    const records = [
      {
        id: crypto.randomUUID(),
        sourceReportId: testData.report.id,
        targetReportId: targetReport.id,
        sourceItemId: crypto.randomUUID(),
        targetItemId: itemId,
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
      authorRole: "lead" as const,
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      late: false,
      projects: [],
      referencedProjects: [],
      items: [
        {
          id: itemId,
          stableId: crypto.randomUUID(),
          projectId: testData.project.id,
          type: "current" as const,
          text: "Ranked, staged carried item",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
          priorityRank: 2,
          stageNames: ["Design", "Build"],
        },
      ],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
    };

    await repo.saveCarryOver(execution, records, [targetSectionReadModel]);

    const created = await prisma.item.findMany({
      where: { reportSectionId: targetSection.id },
    });
    expect(created).toHaveLength(1);
    expect(expectDefined(created[0]).priorityRank).toBe(2);
    expect(expectDefined(created[0]).stageNames).toEqual(["Design", "Build"]);
  });
});
