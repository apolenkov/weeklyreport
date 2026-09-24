import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { applySaveSection } from "../report-sections/test-seams/index.js";
import { CarryOverPrismaRepository } from "./carry-over.prisma-repository";
import { CarryOverConflictError, CarryOverService } from "./carry-over.service";

const LOCK_WAIT_POLL_MS = 25;
const LOCK_WAIT_TIMEOUT_MS = 10_000;

async function waitForCarryOverLock(
  prisma: ReturnType<typeof createTestPrisma>,
): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const waiting = await prisma.$queryRaw<{ pid: number }[]>`
      SELECT activity.pid
      FROM pg_stat_activity AS activity
      JOIN pg_locks AS lock
        ON lock.pid = activity.pid AND NOT lock.granted
      WHERE activity.datname = current_database()
        AND activity.pid <> pg_backend_pid()
        AND activity.query LIKE '%FROM "Report"%'
        AND activity.query LIKE '%FOR UPDATE%'`;
    if (waiting.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_POLL_MS));
  }
  throw new Error(
    `Timed out after ${String(LOCK_WAIT_TIMEOUT_MS)}ms waiting for carry-over to block on the submitted report lock`,
  );
}

describe("CarryOverPrismaRepository (integration) — multi-lead fan-out & races", () => {
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

    // Membership derives from author.stageAssignments: each author owns the
    // same product through a DISTINCT stage — @@unique(stageId, projectId)
    // forbids two users sharing one stage/project row.
    const developmentStage = await prisma.stage.create({
      data: { name: "Development", sortOrder: 1 },
    });
    const testingStage = await prisma.stage.create({
      data: { name: "Testing", sortOrder: 2 },
    });
    await prisma.stageAssignment.createMany({
      data: [
        {
          userId: testData.lead.id,
          stageId: developmentStage.id,
          projectId: testData.project.id,
        },
        {
          userId: testData.head.id,
          stageId: testingStage.id,
          projectId: testData.project.id,
        },
      ],
    });

    // The real read models must show each author owning the product through
    // their own stage — otherwise the membership checks below exercise nothing.
    const preWriteSections = await repo.getTargetSections(targetReport.id);
    const leadRead = expectDefined(
      preWriteSections.find((section) => section.authorId === testData.lead.id),
    );
    const headRead = expectDefined(
      preWriteSections.find((section) => section.authorId === testData.head.id),
    );
    const leadProject = expectDefined(leadRead.projects[0]);
    const headProject = expectDefined(headRead.projects[0]);
    expect(leadProject.projectId).toBe(testData.project.id);
    expect(leadProject.ownedStages.map((stage) => stage.stageId)).toEqual([
      developmentStage.id,
    ]);
    expect(headProject.projectId).toBe(testData.project.id);
    expect(headProject.ownedStages.map((stage) => stage.stageId)).toEqual([
      testingStage.id,
    ]);

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
          stageNames: ["Development"],
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
          stageNames: ["Testing"],
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

  it("carries matched authors without blocking on an unrelated submitted target", async () => {
    const targetReport = await prisma.report.create({
      data: {
        id: TEST_IDS.targetReport,
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
      },
    });
    const matchedTarget = await prisma.reportSection.create({
      data: {
        reportId: targetReport.id,
        authorId: testData.lead.id,
        status: "draft",
      },
    });
    const assignedStage = await prisma.stage.create({
      data: { name: "Development", sortOrder: 1 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        projectId: testData.project.id,
        stageId: assignedStage.id,
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: matchedTarget.id,
        projectId: testData.project.id,
        status: null,
      },
    });
    const unrelatedSubmitted = await prisma.reportSection.create({
      data: {
        reportId: targetReport.id,
        authorId: testData.head.id,
        status: "submitted",
        submittedAt: new Date(),
      },
    });
    const unrelatedBefore = await prisma.reportSection.findUnique({
      where: { id: unrelatedSubmitted.id },
    });
    await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "next",
        text: "Carry only for the matched author",
        tag: "feature",
        workflowStatus: "planned",
        carriedOver: false,
        stageNames: ["Development"],
      },
    });

    const result = await new CarryOverService(repo).executeCarryOver(
      testData.report.id,
      targetReport.id,
    );

    expect(result.records).toHaveLength(1);
    expect(
      await prisma.item.count({
        where: { reportSectionId: matchedTarget.id },
      }),
    ).toBe(1);
    expect(
      await prisma.item.count({
        where: { reportSectionId: unrelatedSubmitted.id },
      }),
    ).toBe(0);
    await expect(
      prisma.reportSection.findUnique({
        where: { id: unrelatedSubmitted.id },
      }),
    ).resolves.toEqual(unrelatedBefore);
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
        periodState: "archived",
        periodStatus: "open",
        archived: true,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
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
          stageNames: ["Development"],
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

  it("rejects a submitted target re-read inside the transaction before any carry rows", async () => {
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
    const staleTarget = (await repo.getTargetSections(targetReport.id))[0];
    if (!staleTarget) throw new Error("target section read model missing");

    await prisma.reportSection.update({
      where: { id: targetSection.id },
      data: { status: "submitted", submittedAt: new Date() },
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
    const carriedItemId = crypto.randomUUID();
    const records = [
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
    ];
    const plannedTarget = {
      ...staleTarget,
      items: [
        ...staleTarget.items,
        {
          id: carriedItemId,
          stableId: crypto.randomUUID(),
          projectId: testData.project.id,
          type: "current" as const,
          text: "Must not be inserted",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
          stageNames: ["Development"],
        },
      ],
    };

    await expect(
      repo.saveCarryOver(execution, records, [plannedTarget]),
    ).rejects.toThrow(CarryOverConflictError);

    expect(await prisma.carryOverExecution.count()).toBe(0);
    expect(await prisma.carryOverRecord.count()).toBe(0);
    expect(
      await prisma.item.count({ where: { reportSectionId: targetSection.id } }),
    ).toBe(0);
  });

  it("wins the submit-vs-carry-over race without a partial carry execution", async () => {
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
    const targetRead = (await repo.getTargetSections(targetReport.id))[0];
    if (!targetRead) throw new Error("target section read model missing");

    const carriedItemId = crypto.randomUUID();
    const plannedTarget = {
      ...targetRead,
      items: [
        {
          id: carriedItemId,
          stableId: crypto.randomUUID(),
          projectId: testData.project.id,
          type: "current" as const,
          text: "Must not be inserted",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: true,
          stageNames: ["Development"],
        },
      ],
    };
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
        targetItemId: carriedItemId,
        sourceDecisionId: null,
        targetDecisionId: null,
        status: "completed" as const,
        carriedAt: new Date(),
      },
    ];
    const submitted = {
      ...targetRead,
      status: "submitted" as const,
      submittedAt: new Date(),
    };
    let releaseSubmit: (() => void) | undefined;
    let signalSubmitReady: (() => void) | undefined;
    const submitReady = new Promise<void>((resolve) => {
      signalSubmitReady = resolve;
    });
    const holdSubmit = new Promise<void>((resolve) => {
      releaseSubmit = resolve;
    });

    // Use the same repository transaction owner as a real submit, then hold
    // its report lock long enough to start carry-over behind it. Carry-over
    // must re-read the now-submitted section after the lock is released.
    const submit = prisma.$transaction(async (tx) => {
      await applySaveSection(tx, submitted, targetRead.version);
      signalSubmitReady?.();
      await holdSubmit;
    });
    await submitReady;
    const carry = repo.saveCarryOver(execution, records, [plannedTarget]);
    let waitFailure: Error | undefined;
    try {
      await waitForCarryOverLock(prisma);
    } catch (error) {
      waitFailure =
        error instanceof Error
          ? error
          : new Error("Carry-over lock wait failed without an Error object");
    } finally {
      releaseSubmit?.();
    }

    const [submitResult, carryResult] = await Promise.allSettled([
      submit,
      carry,
    ]);
    if (waitFailure !== undefined) throw waitFailure;
    expect(submitResult.status).toBe("fulfilled");
    expect(carryResult.status).toBe("rejected");
    if (carryResult.status === "fulfilled") {
      throw new Error("carry-over unexpectedly committed after submit");
    }
    expect(carryResult.reason).toBeInstanceOf(CarryOverConflictError);
    expect(
      await prisma.reportSection.findUnique({
        where: { id: targetSection.id },
      }),
    ).toMatchObject({
      status: "submitted",
      version: 2,
    });
    expect(await prisma.carryOverExecution.count()).toBe(0);
    expect(await prisma.carryOverRecord.count()).toBe(0);
    expect(
      await prisma.item.count({ where: { reportSectionId: targetSection.id } }),
    ).toBe(0);
  });
});
