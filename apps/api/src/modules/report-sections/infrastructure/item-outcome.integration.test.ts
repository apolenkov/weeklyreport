import type { ItemOutcomeResult } from "@customreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import {
  CarryOverPrismaRepository,
  CarryOverService,
} from "../../carry-over/index.js";
import {
  ReportSectionsService,
  SectionVersionConflictError,
} from "../application/report-sections.service";
import {
  LeadFormConstraintError,
  LeadFormDomainError,
} from "../domain/lead-form-shared";
import {
  assignOutcomeStage,
  OUTCOME_CASES,
  outcomeCommand,
  prepareOutcomeSource,
  publishReportFixture,
  seedOutcomeItem,
  unchangedDraftPayload,
} from "./item-outcome.integration.fixtures";
import {
  promotePlanTx,
  resolvePlanTx,
  restorePlanTx,
} from "./item-outcome.transaction";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

const graceSettings = () =>
  Promise.resolve({ gracePeriodHours: 0, allowLateSubmissions: true });

describe("item outcomes (real database)", () => {
  const prisma = createTestPrisma();
  const prismaService = prisma as unknown as PrismaService;
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let ordinarySave: ReportSectionsService;

  beforeAll(() => {
    ordinarySave = new ReportSectionsService(
      new ReportSectionsPrismaRepository(prismaService),
      graceSettings,
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    await assignOutcomeStage(prisma, testData);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  function resolvedItem(result: ItemOutcomeResult) {
    return expectDefined(
      result.section.items.find((item) => item.stableId === result.stableId),
    );
  }

  it.each(OUTCOME_CASES)(
    "materializes $sourceKind $outcome atomically without mutating a prior snapshot",
    async ({
      sourceKind,
      outcome,
      currentType,
      currentStatus,
      priorType,
      priorStatus,
    }) => {
      const prepared = await prepareOutcomeSource(prisma, testData, sourceKind);
      const input = outcomeCommand(
        testData.section.id,
        prepared.source,
        outcome,
      );

      const result = await resolvePlanTx(
        prismaService,
        input,
        testData.lead.id,
      );
      const item = resolvedItem(result);

      expect(result.replayed).toBe(false);
      expect(result.section.version).toBe(2);
      expect(item).toMatchObject({
        stableId: prepared.item.stableId,
        type: sourceKind === "prior" ? priorType : currentType,
        workflowStatus: sourceKind === "prior" ? priorStatus : currentStatus,
      });
      expect(item.nextStepText).toBe(
        sourceKind === "current" && outcome === "plan_next"
          ? "Verify the next-period metrics"
          : null,
      );
      expect(item.resolution === null).toBe(outcome !== "wont_do");
      expect(item.outcomeHistory).toHaveLength(1);
      expect(item.outcomeHistory?.[0]).toMatchObject({
        id: input.commandId,
        outcome,
        actorId: testData.lead.id,
      });

      if (prepared.prior) {
        const [priorReport, priorItem] = await Promise.all([
          prisma.report.findUniqueOrThrow({
            where: { id: prepared.prior.report.id },
            select: { publishedSnapshot: true },
          }),
          prisma.item.findUniqueOrThrow({
            where: { id: prepared.prior.item.id },
          }),
        ]);
        expect(priorReport.publishedSnapshot).toEqual(prepared.prior.snapshot);
        expect(priorItem).toMatchObject({
          id: prepared.prior.item.id,
          stableId: prepared.prior.item.stableId,
          type: "next",
          workflowStatus: "postponed",
          text: "Drifted live row",
        });
      }
    },
  );

  it.each(["current", "prior"] as const)(
    "restores the exact %s tuple and appends a reversal audit",
    async (sourceKind) => {
      const prepared = await prepareOutcomeSource(prisma, testData, sourceKind);
      const cancel = outcomeCommand(
        testData.section.id,
        prepared.source,
        "wont_do",
      );
      const cancelled = await resolvePlanTx(
        prismaService,
        cancel,
        testData.lead.id,
      );
      const cancelledItem = resolvedItem(cancelled);

      const restored = await restorePlanTx(
        prismaService,
        {
          reportSectionId: testData.section.id,
          version: cancelled.section.version,
          commandId: crypto.randomUUID(),
          recordId: expectDefined(cancelledItem.id),
        },
        testData.lead.id,
      );
      const item = resolvedItem(restored);

      expect(item).toMatchObject({
        stableId: prepared.item.stableId,
        type: sourceKind === "prior" ? "next" : "current",
        workflowStatus: sourceKind === "prior" ? "planned" : "in_progress",
        resolution: null,
      });
      expect(item.outcomeHistory).toHaveLength(2);
      expect(item.outcomeHistory?.[1]).toMatchObject({
        outcome: "restore",
        reversesEventId: cancel.commandId,
      });
    },
  );

  it("preserves cancellation audit through ordinary save, physical id remint, and replay", async () => {
    const prepared = await prepareOutcomeSource(prisma, testData, "current");
    const input = outcomeCommand(
      testData.section.id,
      prepared.source,
      "wont_do",
    );
    const cancelled = await resolvePlanTx(
      prismaService,
      input,
      testData.lead.id,
    );
    const beforeSave = resolvedItem(cancelled);

    const saved = await ordinarySave.saveDraft(
      unchangedDraftPayload(cancelled.section),
      testData.lead.id,
    );
    const afterSave = expectDefined(saved.items[0]);
    expect(afterSave.id).not.toBe(beforeSave.id);
    expect(afterSave.stableId).toBe(beforeSave.stableId);
    expect(afterSave.resolution).toEqual(beforeSave.resolution);
    expect(afterSave.outcomeHistory).toEqual(beforeSave.outcomeHistory);

    const replay = await resolvePlanTx(prismaService, input, testData.lead.id);
    expect(replay).toMatchObject({
      replayed: true,
      stableId: prepared.item.stableId,
    });
    expect(resolvedItem(replay).id).toBe(afterSave.id);
    await expect(
      prisma.itemOutcomeEvent.count({
        where: { reportSectionId: testData.section.id },
      }),
    ).resolves.toBe(1);
  });

  it("rolls back stale and unauthorized commands without version or event residue", async () => {
    const prepared = await prepareOutcomeSource(prisma, testData, "current");
    const attempts = [
      {
        input: outcomeCommand(testData.section.id, prepared.source, "done", {
          version: 99,
        }),
        userId: testData.lead.id,
        error: SectionVersionConflictError,
      },
      {
        input: outcomeCommand(testData.section.id, prepared.source, "done"),
        userId: testData.head.id,
        error: LeadFormDomainError,
      },
    ];

    for (const attempt of attempts) {
      await expect(
        resolvePlanTx(prismaService, attempt.input, attempt.userId),
      ).rejects.toBeInstanceOf(attempt.error);
      await expect(
        prisma.reportSection.findUniqueOrThrow({
          where: { id: testData.section.id },
          select: { version: true },
        }),
      ).resolves.toEqual({ version: 1 });
      await expect(
        prisma.itemOutcomeEvent.count({
          where: { reportSectionId: testData.section.id },
        }),
      ).resolves.toBe(0);
    }
  });

  it("carries a planned next item as current planned and leaves postponed work behind", async () => {
    const planned = await seedOutcomeItem(prisma, {
      sectionId: testData.section.id,
      projectId: testData.project.id,
      type: "next",
      workflowStatus: "planned",
      text: "Carry this commitment",
    });
    await seedOutcomeItem(prisma, {
      sectionId: testData.section.id,
      projectId: testData.project.id,
      type: "next",
      workflowStatus: "postponed",
      text: "Replan this explicitly",
    });
    await publishReportFixture(prisma, {
      reportId: testData.report.id,
      sectionId: testData.section.id,
      authorId: testData.lead.id,
      groupId: expectDefined(testData.lead.reportingGroupId),
    });
    const targetReport = await prisma.report.create({
      data: {
        periodStart: new Date("2026-04-14T00:00:00.000Z"),
        periodEnd: new Date("2026-04-20T00:00:00.000Z"),
      },
    });
    const targetSection = await prisma.reportSection.create({
      data: { reportId: targetReport.id, authorId: testData.lead.id },
    });

    const carry = await new CarryOverService(
      new CarryOverPrismaRepository(prismaService),
    ).executeCarryOver(testData.report.id, targetReport.id);
    const rows = await prisma.item.findMany({
      where: { reportSectionId: targetSection.id },
    });

    expect(carry.execution.carriedItemCount).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      stableId: planned.stableId,
      type: "current",
      workflowStatus: "planned",
      carriedOver: true,
    });
  });

  it("promotes a linked next step atomically and keeps the superseded result in history", async () => {
    const prepared = await prepareOutcomeSource(prisma, testData, "current");
    const planned = await resolvePlanTx(
      prismaService,
      outcomeCommand(testData.section.id, prepared.source, "plan_next"),
      testData.lead.id,
    );
    const plannedItem = resolvedItem(planned);
    const previousText = plannedItem.text;
    expect(plannedItem.nextStepText).toBe("Verify the next-period metrics");

    const promoted = await promotePlanTx(
      prismaService,
      {
        reportSectionId: testData.section.id,
        version: planned.section.version,
        commandId: crypto.randomUUID(),
        recordId: expectDefined(plannedItem.id),
      },
      testData.lead.id,
    );
    const item = resolvedItem(promoted);

    expect(item).toMatchObject({
      stableId: prepared.item.stableId,
      type: "current",
      workflowStatus: "in_progress",
      nextStepText: null,
      text: "Verify the next-period metrics",
      carriedOver: false,
      resolution: null,
    });
    const promotion = item.outcomeHistory?.at(-1);
    expect(promotion).toMatchObject({ outcome: "promote" });
    expect(promotion?.beforeState).toMatchObject({
      text: previousText,
      nextStepText: "Verify the next-period metrics",
    });
    expect(promotion?.afterState).toMatchObject({
      text: "Verify the next-period metrics",
      nextStepText: null,
    });
  });

  it("keeps the displaced commitment in history when a continuation is replaced", async () => {
    const prepared = await prepareOutcomeSource(prisma, testData, "current");
    const planned = await resolvePlanTx(
      prismaService,
      outcomeCommand(testData.section.id, prepared.source, "plan_next"),
      testData.lead.id,
    );
    const plannedItem = resolvedItem(planned);
    expect(plannedItem.nextStepText).toBe("Verify the next-period metrics");

    const replaced = await resolvePlanTx(
      prismaService,
      outcomeCommand(testData.section.id, prepared.source, "continue", {
        version: planned.section.version,
        nextStepText: "Replacement commitment",
      }),
      testData.lead.id,
    );
    const item = resolvedItem(replaced);

    expect(item).toMatchObject({
      text: "Outcome source",
      nextStepText: "Replacement commitment",
    });
    const replacement = item.outcomeHistory?.at(-1);
    expect(replacement).toMatchObject({ outcome: "continue" });
    expect(replacement?.beforeState).toMatchObject({
      nextStepText: "Verify the next-period metrics",
    });
    expect(replacement?.afterState).toMatchObject({
      nextStepText: "Replacement commitment",
    });
  });

  it("rejects promotion without a commitment or from completed work", async () => {
    const prepared = await prepareOutcomeSource(prisma, testData, "current");
    const withoutCommitment = () =>
      promotePlanTx(
        prismaService,
        {
          reportSectionId: testData.section.id,
          version: 1,
          commandId: crypto.randomUUID(),
          recordId: prepared.item.id,
        },
        testData.lead.id,
      );

    await expect(withoutCommitment()).rejects.toThrow(LeadFormConstraintError);

    const completed = await seedOutcomeItem(prisma, {
      sectionId: testData.section.id,
      projectId: testData.project.id,
      workflowStatus: "done",
      text: "Completed work",
    });
    await expect(
      promotePlanTx(
        prismaService,
        {
          reportSectionId: testData.section.id,
          version: 1,
          commandId: crypto.randomUUID(),
          recordId: completed.id,
        },
        testData.lead.id,
      ),
    ).rejects.toThrow(LeadFormConstraintError);
  });
});
