import { Prisma } from "@prisma/client";
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
import { CarryOverService } from "./carry-over.service";

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
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  // Membership in the locked re-read comes from the real assignment graph:
  // the StageAssignment attaches the product to the author and the section
  // projectStatus row mirrors what assignment reconciliation writes alongside.
  async function attachProductToAuthor(
    authorId: string,
    reportSectionId: string,
  ) {
    const stage = await prisma.stage.create({ data: { name: "Development" } });
    await prisma.stageAssignment.create({
      data: {
        userId: authorId,
        stageId: stage.id,
        projectId: testData.project.id,
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId,
        projectId: testData.project.id,
        status: null,
      },
    });
    return stage;
  }

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

    await attachProductToAuthor(testData.lead.id, targetSection.id);

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
    await attachProductToAuthor(testData.lead.id, targetSection.id);

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

    await attachProductToAuthor(testData.lead.id, targetSection.id);

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
    await attachProductToAuthor(testData.lead.id, targetSection.id);

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
    await attachProductToAuthor(testData.lead.id, targetSection.id);

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

  // The shared seed fixture creates no StageAssignment; these tests add a
  // local stage+assignment so the membership checks below exercise the real
  // author.stageAssignments → projects projection.
  it("derives the section projects projection from the author's stage assignments", async () => {
    const targetReport = await prisma.report.create({
      data: {
        id: TEST_IDS.targetReport,
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
      },
    });
    const leadSectionRow = await prisma.reportSection.create({
      data: {
        reportId: targetReport.id,
        authorId: testData.lead.id,
        status: "draft",
      },
    });
    await prisma.reportSection.create({
      data: {
        reportId: targetReport.id,
        authorId: testData.head.id,
        status: "draft",
      },
    });
    const stage = await attachProductToAuthor(
      testData.lead.id,
      leadSectionRow.id,
    );

    const sections = await repo.getTargetSections(targetReport.id);
    const leadSection = expectDefined(
      sections.find((section) => section.authorId === testData.lead.id),
    );
    const headSection = expectDefined(
      sections.find((section) => section.authorId === testData.head.id),
    );

    expect(leadSection.projects.map((project) => project.projectId)).toEqual([
      testData.project.id,
    ]);
    const project = expectDefined(leadSection.projects[0]);
    expect(project.ownedStages.map((owned) => owned.stageId)).toEqual([
      stage.id,
    ]);
    expect(project.ownerGroupId).toBe(TEST_IDS.group);
    expect(headSection.projects).toEqual([]);
  });

  it("writes zero carried rows when the plan's last stage assignment was removed before the write", async () => {
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
    const stage = await prisma.stage.create({
      data: { name: "Development" },
    });
    const assignment = await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        stageId: stage.id,
        projectId: testData.project.id,
      },
    });

    // The plan is captured while the author still owns the product — the same
    // stale snapshot a pre-transaction plan carries into the write.
    const staleTarget = expectDefined(
      (await repo.getTargetSections(targetReport.id))[0],
    );
    expect(staleTarget.projects.map((project) => project.projectId)).toContain(
      testData.project.id,
    );

    await prisma.stageAssignment.delete({ where: { id: assignment.id } });

    const carriedItemId = crypto.randomUUID();
    const result = await repo.saveCarryOver(
      {
        id: crypto.randomUUID(),
        sourceReportId: testData.report.id,
        targetReportId: targetReport.id,
        dedupeKey: `${testData.report.id}:${targetReport.id}`,
        status: "completed" as const,
        startedAt: new Date(),
        completedAt: new Date(),
        carriedItemCount: 1,
        carriedDecisionCount: 0,
      },
      [
        {
          id: crypto.randomUUID(),
          sourceReportId: testData.report.id,
          targetReportId: targetReport.id,
          sourceItemId: crypto.randomUUID(),
          targetItemId: carriedItemId,
          sourceDecisionId: null,
          targetDecisionId: null,
          status: "completed" as const,
          carriedAt: new Date(),
        },
      ],
      [
        {
          ...staleTarget,
          items: [
            {
              id: carriedItemId,
              stableId: crypto.randomUUID(),
              projectId: testData.project.id,
              type: "current" as const,
              text: "Stale-membership clone",
              tag: "feature",
              workflowStatus: "in_progress" as const,
              carriedOver: true,
              stageNames: ["Development"],
            },
          ],
        },
      ],
    );

    // The locked re-read sees empty membership: no clone row, no lineage
    // record, and no positive inserted count on the execution.
    expect(result.records).toHaveLength(0);
    expect(result.execution.carriedItemCount).toBe(0);
    expect(result.targetSection.version).toBe(staleTarget.version);
    expect(
      await prisma.item.count({
        where: { reportSectionId: targetSection.id },
      }),
    ).toBe(0);
    expect(await prisma.carryOverRecord.count()).toBe(0);
  });

  // End-to-end planner + write path: one lineage per rollover rule, records
  // per inserted clone, version bump per the write contract, replay a no-op,
  // and paused/resolved source history untouched.
  it("persists commitment and continuation rollover through executeCarryOver, replay inserting nothing", async () => {
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
    await attachProductToAuthor(testData.lead.id, targetSection.id);

    const commitment = await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "next",
        text: "Ship the beta",
        tag: "feature",
        workflowStatus: "planned",
        carriedOver: false,
        priorityRank: 2,
        stageNames: ["Development"],
      },
    });
    const continuation = await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "Beta still running",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: true,
        priorityRank: 3,
        stageNames: ["Development"],
      },
    });
    const paused = await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "Legal-blocked item",
        tag: "feature",
        workflowStatus: "paused",
        pausedReason: "Waiting on legal review",
        carriedOver: false,
        stageNames: ["Development"],
      },
    });
    const outcomeState: Prisma.InputJsonValue = {
      type: "current",
      workflowStatus: "in_progress",
      pausedReason: null,
      nextStepText: null,
      text: "Descoped item",
    };
    const resolution: Prisma.InputJsonValue = {
      kind: "wont_do",
      eventId: crypto.randomUUID(),
      reason: "Descoped",
      actorId: testData.head.id,
      actorName: "Test Head",
      occurredAt: "2026-04-10T09:00:00.000Z",
      previousState: outcomeState,
    };
    const resolvedStableId = crypto.randomUUID();
    const resolved = await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        stableId: resolvedStableId,
        type: "current",
        text: "Descoped item",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        resolution,
        stageNames: ["Development"],
      },
    });
    await prisma.itemOutcomeEvent.create({
      data: {
        id: crypto.randomUUID(),
        reportSectionId: testData.section.id,
        stableId: resolvedStableId,
        requestHash: "0".repeat(64),
        outcome: "wont_do",
        reason: "Descoped",
        actorId: testData.head.id,
        actorName: "Test Head",
        beforeState: outcomeState,
        afterState: outcomeState,
      },
    });
    const sourceItemsBefore = await prisma.item.findMany({
      where: { reportSectionId: testData.section.id },
    });

    const service = new CarryOverService(repo);
    const first = await service.executeCarryOver(
      testData.report.id,
      targetReport.id,
    );

    const targetItems = await prisma.item.findMany({
      where: { reportSectionId: targetSection.id },
    });
    expect(targetItems).toHaveLength(2);
    const byStableId = new Map(
      targetItems.map((item) => [item.stableId, item]),
    );
    expect(byStableId.get(commitment.stableId)).toMatchObject({
      type: "current",
      workflowStatus: "planned",
      text: "Ship the beta",
      carriedOver: true,
      priorityRank: 2,
      nextStepText: null,
      pausedReason: null,
      stageNames: ["Development"],
    });
    expect(byStableId.get(continuation.stableId)).toMatchObject({
      type: "current",
      workflowStatus: "in_progress",
      text: "Beta still running",
      carriedOver: true,
      priorityRank: 3,
      nextStepText: null,
      pausedReason: null,
    });

    // One CarryOverRecord per inserted clone, pointing at its source row.
    const records = await prisma.carryOverRecord.findMany({
      where: { executionId: first.execution.id },
    });
    expect(records).toHaveLength(2);
    expect(first.execution.carriedItemCount).toBe(2);
    for (const source of [commitment, continuation]) {
      const clone = expectDefined(byStableId.get(source.stableId));
      expect(
        records.some(
          (record) =>
            record.recordType === "item" &&
            record.sourceItemId === source.id &&
            record.targetItemId === clone.id,
        ),
      ).toBe(true);
    }

    // The write contract bumps the section version only when rows insert.
    await expect(
      prisma.reportSection.findUnique({ where: { id: targetSection.id } }),
    ).resolves.toMatchObject({ version: 2 });

    // Paused/resolved source rows and their audit trail are untouched.
    const sourceItemsAfter = await prisma.item.findMany({
      where: { reportSectionId: testData.section.id },
    });
    expect(sourceItemsAfter).toHaveLength(sourceItemsBefore.length);
    const pausedAfter = expectDefined(
      sourceItemsAfter.find((item) => item.id === paused.id),
    );
    expect(pausedAfter).toMatchObject({
      workflowStatus: "paused",
      pausedReason: "Waiting on legal review",
      carriedOver: false,
    });
    const resolvedAfter = expectDefined(
      sourceItemsAfter.find((item) => item.id === resolved.id),
    );
    expect(resolvedAfter.resolution).toEqual(resolution);
    await expect(
      prisma.itemOutcomeEvent.count({
        where: { reportSectionId: testData.section.id },
      }),
    ).resolves.toBe(1);

    // Replay resolves the recorded execution: no second clone, record, or
    // version bump.
    const second = await service.executeCarryOver(
      testData.report.id,
      targetReport.id,
    );
    expect(second.execution.id).toBe(first.execution.id);
    await expect(
      prisma.item.count({ where: { reportSectionId: targetSection.id } }),
    ).resolves.toBe(2);
    await expect(
      prisma.carryOverRecord.count({
        where: { executionId: first.execution.id },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.reportSection.findUnique({ where: { id: targetSection.id } }),
    ).resolves.toMatchObject({ version: 2 });
  });
});
