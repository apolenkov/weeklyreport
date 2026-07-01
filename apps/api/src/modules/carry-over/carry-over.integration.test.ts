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
      version: 1,
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

  // introduce-durable-record-identity (task 5.2): saveCarryOver must persist the
  // source record's stableId onto the clone so a carried позиция shares one
  // lineage key with its origin, while the clone still gets its own PK id.
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
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      projects: [],
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
          completed: null,
        },
      ],
      risks: [],
      decisions: [],
      priorities: [],
    };

    await repo.saveCarryOver(execution, [], [targetSectionReadModel]);

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

  it("carries an unresolved decision with product + stageIds without aborting", async () => {
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
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      projects: [],
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
          stageIds: ["Development", "Design"],
          productId: testData.project.id,
        },
      ],
    };

    // The old write used a non-existent `stageName` field, aborting the whole
    // transaction whenever a carried decision had a product. This must commit.
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
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      projects: [],
      items: [
        {
          id: itemId,
          projectId: testData.project.id,
          type: "current" as const,
          text: "Ranked, staged carried item",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
          completed: null,
          priorityRank: 2,
          stageIds: ["Design", "Build"],
        },
      ],
      risks: [],
      decisions: [],
    };

    await repo.saveCarryOver(execution, records, [targetSectionReadModel]);

    const created = await prisma.item.findMany({
      where: { reportSectionId: targetSection.id },
    });
    expect(created).toHaveLength(1);
    expect(expectDefined(created[0]).priorityRank).toBe(2);
    expect(expectDefined(created[0]).stageNames).toEqual(["Design", "Build"]);
  });

  it("persists carried rows for every target section in a multi-lead report", async () => {
    const targetReport = await prisma.report.create({
      data: {
        id: TEST_IDS.targetReport,
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
      },
    });
    const sectionLead = await prisma.reportSection.create({
      data: {
        reportId: targetReport.id,
        authorId: testData.lead.id,
        status: "draft",
      },
    });
    const sectionHead = await prisma.reportSection.create({
      data: {
        reportId: targetReport.id,
        authorId: testData.head.id,
        status: "draft",
      },
    });

    const itemLeadId = crypto.randomUUID();
    const itemHeadId = crypto.randomUUID();
    const execution = {
      id: crypto.randomUUID(),
      sourceReportId: testData.report.id,
      targetReportId: targetReport.id,
      dedupeKey: `${testData.report.id}:${targetReport.id}`,
      status: "completed" as const,
      startedAt: new Date(),
      completedAt: new Date(),
      carriedItemCount: 2,
      carriedDecisionCount: 0,
    };
    const records = [itemLeadId, itemHeadId].map((targetItemId) => ({
      id: crypto.randomUUID(),
      sourceReportId: testData.report.id,
      targetReportId: targetReport.id,
      sourceItemId: crypto.randomUUID(),
      targetItemId,
      sourceDecisionId: null,
      targetDecisionId: null,
      status: "completed" as const,
      carriedAt: new Date(),
    }));
    const sectionLeadReadModel = {
      reportSectionId: sectionLead.id,
      reportId: targetReport.id,
      authorId: testData.lead.id,
      authorName: "Test Lead 1",
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      projects: [],
      items: [
        {
          id: itemLeadId,
          projectId: testData.project.id,
          type: "current" as const,
          text: "Lead carried item",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
          completed: null,
        },
      ],
      risks: [],
      decisions: [],
    };
    const sectionHeadReadModel = {
      ...sectionLeadReadModel,
      reportSectionId: sectionHead.id,
      authorId: testData.head.id,
      authorName: "Test Head",
      items: [
        {
          id: itemHeadId,
          projectId: testData.project.id,
          type: "current" as const,
          text: "Head carried item",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
          completed: null,
        },
      ],
    };

    await repo.saveCarryOver(execution, records, [
      sectionLeadReadModel,
      sectionHeadReadModel,
    ]);

    const leadItems = await prisma.item.findMany({
      where: { reportSectionId: sectionLead.id },
    });
    const headItems = await prisma.item.findMany({
      where: { reportSectionId: sectionHead.id },
    });
    expect(leadItems).toHaveLength(1);
    expect(headItems).toHaveLength(1);
    // Persisted item count matches the execution's reported carriedItemCount.
    const persisted = await prisma.item.count({
      where: { reportSectionId: { in: [sectionLead.id, sectionHead.id] } },
    });
    expect(persisted).toBe(execution.carriedItemCount);
  });

  it("resolves the dedupeKey unique-constraint race to the existing execution (no 500)", async () => {
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
    // Pre-insert the execution that "won" a concurrent race, holding the
    // dedupeKey. Its source/target are swapped so the in-transaction findFirst
    // (keyed on source/target, not dedupeKey) misses it and the create reaches
    // the unique constraint — exactly the race the catch must absorb.
    const winnerId = crypto.randomUUID();
    await prisma.carryOverExecution.create({
      data: {
        id: winnerId,
        sourceReportId: targetReport.id,
        targetReportId: testData.report.id,
        dedupeKey,
        status: "completed",
      },
    });

    const execution = {
      id: crypto.randomUUID(),
      sourceReportId: testData.report.id,
      targetReportId: targetReport.id,
      dedupeKey,
      status: "completed" as const,
      startedAt: new Date(),
      completedAt: new Date(),
      carriedItemCount: 0,
      carriedDecisionCount: 0,
    };
    const targetSectionReadModel = {
      reportSectionId: targetSection.id,
      reportId: targetReport.id,
      authorId: testData.lead.id,
      authorName: "Test Lead 1",
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      projects: [],
      items: [],
      risks: [],
      decisions: [],
    };

    const result = await repo.saveCarryOver(
      execution,
      [],
      [targetSectionReadModel],
    );

    // Idempotent: the conflict resolves to the already-recorded execution, and
    // no duplicate row is created.
    expect(result.execution.id).toBe(winnerId);
    const all = await prisma.carryOverExecution.findMany({
      where: { dedupeKey },
    });
    expect(all).toHaveLength(1);
    expect(expectDefined(all[0]).id).toBe(winnerId);
  });
});
