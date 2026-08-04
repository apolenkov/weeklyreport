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
import { CarryOverConflictError } from "./carry-over.service";

describe("CarryOverPrismaRepository (integration) — multi-lead fan-out & races", () => {
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
      authorRole: "lead" as const,
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      late: false,
      projects: [],
      referencedProjects: [],
      items: [
        {
          id: itemLeadId,
          stableId: crypto.randomUUID(),
          projectId: testData.project.id,
          type: "current" as const,
          text: "Lead carried item",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
        },
      ],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
    };
    const sectionHeadReadModel = {
      ...sectionLeadReadModel,
      reportSectionId: sectionHead.id,
      authorId: testData.head.id,
      authorName: "Test Head",
      authorRole: "head" as const,
      items: [
        {
          id: itemHeadId,
          stableId: crypto.randomUUID(),
          projectId: testData.project.id,
          type: "current" as const,
          text: "Head carried item",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
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
    // dedupeKey. Source/target are swapped so the in-tx findFirst (keyed on
    // source/target, not dedupeKey) misses it and the create hits the constraint.
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
      authorRole: "lead" as const,
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      late: false,
      projects: [],
      referencedProjects: [],
      items: [],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
    };

    const result = await repo.saveCarryOver(
      execution,
      [],
      [targetSectionReadModel],
    );

    // Idempotent: the conflict resolves to the already-recorded execution, and
    // no duplicate row is created. Every returned entity belongs to the
    // winner's target report, never the loser's merged target section.
    expect(result.execution.id).toBe(winnerId);
    expect(result.targetSection.reportId).toBe(testData.report.id);
    expect(result.targetSection.reportId).toBe(result.execution.targetReportId);
    const all = await prisma.carryOverExecution.findMany({
      where: { dedupeKey },
    });
    expect(all).toHaveLength(1);
    expect(expectDefined(all[0]).id).toBe(winnerId);
  });

  it("resolves the source/target race to the winner's recorded rows, never inserting the phantom caller's records", async () => {
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
    // A winner already committed an execution (+ record) for this exact
    // source/target pair, so the in-transaction findFirst (keyed on
    // source/target) matches it and the loser must resolve to its rows.
    const winnerId = crypto.randomUUID();
    const winnerRecordId = crypto.randomUUID();
    const winnerTargetItemId = crypto.randomUUID();
    await prisma.carryOverExecution.create({
      data: {
        id: winnerId,
        sourceReportId: testData.report.id,
        targetReportId: targetReport.id,
        dedupeKey,
        status: "completed",
        records: {
          create: [
            {
              id: winnerRecordId,
              sourceItemId: crypto.randomUUID(),
              targetItemId: winnerTargetItemId,
              recordType: "item",
            },
          ],
        },
      },
    });

    const phantomExecution = {
      id: crypto.randomUUID(),
      sourceReportId: testData.report.id,
      targetReportId: targetReport.id,
      dedupeKey,
      status: "completed" as const,
      startedAt: new Date(),
      completedAt: new Date(),
      carriedItemCount: 1,
      carriedDecisionCount: 0,
    };
    const phantomRecords = [
      {
        id: crypto.randomUUID(),
        sourceReportId: testData.report.id,
        targetReportId: targetReport.id,
        sourceItemId: crypto.randomUUID(),
        targetItemId: crypto.randomUUID(),
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
      items: [],
      risks: [],
      decisions: [],
      priorities: [],
      activities: [],
      reviews: [],
    };

    const result = await repo.saveCarryOver(phantomExecution, phantomRecords, [
      targetSectionReadModel,
    ]);

    // Returns the winner's execution and record, not the phantom caller's.
    expect(result.execution.id).toBe(winnerId);
    expect(result.records).toHaveLength(1);
    expect(expectDefined(result.records[0]).id).toBe(winnerRecordId);
    expect(expectDefined(result.records[0]).targetItemId).toBe(
      winnerTargetItemId,
    );

    // The phantom records were never inserted against the uncommitted id —
    // only the winner's single execution and record survive.
    const allExecutions = await prisma.carryOverExecution.findMany();
    expect(allExecutions).toHaveLength(1);
    expect(expectDefined(allExecutions[0]).id).toBe(winnerId);
    const allRecords = await prisma.carryOverRecord.findMany();
    expect(allRecords).toHaveLength(1);
    expect(expectDefined(allRecords[0]).id).toBe(winnerRecordId);
  });

  it("aborts without writing when the target period stopped being editable before the write", async () => {
    // The target is archived — no longer editable. The service's
    // pre-transaction check is bypassed here (repo called directly), so this
    // exercises the in-transaction re-check that closes the TOCTOU window.
    const targetReport = await prisma.report.create({
      data: {
        id: TEST_IDS.targetReport,
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
        archived: true,
      },
    });
    const targetSection = await prisma.reportSection.create({
      data: {
        reportId: targetReport.id,
        authorId: testData.lead.id,
        status: "draft",
      },
    });

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
        targetItemId: crypto.randomUUID(),
        sourceDecisionId: null,
        targetDecisionId: null,
        status: "completed" as const,
        carriedAt: new Date(),
      },
    ];
    // A carriable item in the read model proves the abort rolls back the
    // section-row writes too, not just the execution insert.
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
          id: crypto.randomUUID(),
          projectId: testData.project.id,
          type: "current" as const,
          text: "Would have been carried",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
        },
      ],
      risks: [],
      decisions: [],
      priorities: [],
      activities: [],
      reviews: [],
    };

    await expect(
      repo.saveCarryOver(execution, records, [targetSectionReadModel]),
    ).rejects.toThrow(CarryOverConflictError);

    // Nothing was written: no execution, no record, no carried item/decision.
    expect(await prisma.carryOverExecution.count()).toBe(0);
    expect(await prisma.carryOverRecord.count()).toBe(0);
    expect(
      await prisma.item.count({
        where: { reportSectionId: targetSection.id },
      }),
    ).toBe(0);
    expect(
      await prisma.decision.count({
        where: { reportSectionId: targetSection.id },
      }),
    ).toBe(0);
  });
});
