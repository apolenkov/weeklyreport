import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../../lib/logger.js";
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
import { LeadFormService } from "../application/lead-form.service";
import { ReportSectionsService } from "../application/report-sections.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "../application/report-sections-telemetry.port.js";
import {
  assignOutcomeStage,
  createOutcomePeriod,
  outcomeCommand,
  publishReportFixture,
  seedOutcomeItem,
  unchangedDraftPayload,
} from "./item-outcome.integration.fixtures";
import { resolvePlanTx } from "./item-outcome.transaction";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

describe("item outcome history across reporting gaps (real database)", () => {
  const prisma = createTestPrisma();
  const prismaService = prisma as unknown as PrismaService;
  const carry = new CarryOverService(
    new CarryOverPrismaRepository(prismaService),
    createNullLogger(),
  );
  const leadForm = new LeadFormService(
    new LeadFormPrismaRepository(prismaService),
    NOOP_REPORT_SECTIONS_TELEMETRY,
  );
  const sectionRepository = new ReportSectionsPrismaRepository(prismaService);
  const ordinarySave = new ReportSectionsService(
    sectionRepository,
    NOOP_REPORT_SECTIONS_TELEMETRY,
    createNullLogger(),
  );
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

  it.each(["paused", "postponed"] as const)(
    "keeps one lineage discoverable through a %s two-period gap, then resumes and completes it",
    async (gapStatus) => {
      const snapshots = new Map<string, unknown>();
      const publish = async (period: {
        report: { id: string };
        section: { id: string };
      }) => {
        const snapshot = await publishReportFixture(prisma, {
          reportId: period.report.id,
          sectionId: period.section.id,
          authorId: testData.lead.id,
          groupId: expectDefined(testData.lead.reportingGroupId),
        });
        snapshots.set(period.report.id, snapshot);
      };

      const period0 = {
        report: testData.report,
        section: testData.section,
      };
      const planned = await seedOutcomeItem(prisma, {
        sectionId: period0.section.id,
        projectId: testData.project.id,
        type: "next",
        workflowStatus: "planned",
        text: "Deliver tracked work",
      });
      await publish(period0);

      const period1 = await createOutcomePeriod(prisma, testData, 1);
      const carried1 = await carry.executeCarryOver(
        period0.report.id,
        period1.report.id,
      );
      const period1Item = expectDefined(carried1.targetSection.items[0]);
      const partial = await resolvePlanTx(
        prismaService,
        outcomeCommand(
          period1.section.id,
          { kind: "current", recordId: expectDefined(period1Item.id) },
          "continue",
          {
            version: carried1.targetSection.version,
            text: "Delivered the API slice",
            nextStepText: "Finish integration verification",
          },
        ),
        testData.lead.id,
      );
      expect(partial.section.items[0]).toMatchObject({
        stableId: planned.stableId,
        workflowStatus: "in_progress",
        text: "Delivered the API slice",
        nextStepText: "Finish integration verification",
      });
      await publish(period1);

      const period2 = await createOutcomePeriod(prisma, testData, 2);
      const carried2 = await carry.executeCarryOver(
        period1.report.id,
        period2.report.id,
      );
      const period2Item = expectDefined(carried2.targetSection.items[0]);
      const gap = await ordinarySave.saveDraft(
        {
          ...unchangedDraftPayload(carried2.targetSection),
          items: [
            {
              ...period2Item,
              type: gapStatus === "paused" ? "current" : "next",
              workflowStatus: gapStatus,
              pausedReason:
                gapStatus === "paused" ? "Waiting for approval" : null,
              nextStepText: null,
            },
          ],
        },
        testData.lead.id,
      );
      expect(gap.items[0]).toMatchObject({
        stableId: planned.stableId,
        workflowStatus: gapStatus,
      });
      await publish(period2);

      const period3 = await createOutcomePeriod(prisma, testData, 3);
      const blockedCarry = await carry.executeCarryOver(
        period2.report.id,
        period3.report.id,
      );
      expect(blockedCarry.execution.carriedItemCount).toBe(0);
      expect(blockedCarry.targetSection.items).toEqual([]);
      await publish(period3);

      const period4 = await createOutcomePeriod(prisma, testData, 4);
      const emptyCarry = await carry.executeCarryOver(
        period3.report.id,
        period4.report.id,
      );
      expect(emptyCarry.targetSection.items).toEqual([]);
      await publish(period4);

      const period5 = await createOutcomePeriod(prisma, testData, 5);
      const openWork = await leadForm.getOpenWork(
        { reportId: period5.report.id, limit: 10 },
        testData.lead.id,
      );
      const lineageBeforeResume = openWork.occurrences.filter(
        (entry) => entry.item.stableId === planned.stableId,
      );
      expect(lineageBeforeResume.map((entry) => entry.reportId)).toEqual([
        period2.report.id,
        period1.report.id,
        period0.report.id,
      ]);
      expect(
        lineageBeforeResume.map((entry) => entry.item.workflowStatus),
      ).toEqual([gapStatus, "in_progress", "planned"]);

      const gapOccurrence = expectDefined(lineageBeforeResume[0]);
      const resumed = await resolvePlanTx(
        prismaService,
        outcomeCommand(
          period5.section.id,
          {
            kind: "prior",
            reportId: gapOccurrence.reportId,
            recordId: expectDefined(gapOccurrence.item.id),
          },
          "continue",
        ),
        testData.lead.id,
      );
      const resumedItem = expectDefined(resumed.section.items[0]);
      const done = await resolvePlanTx(
        prismaService,
        outcomeCommand(
          period5.section.id,
          { kind: "current", recordId: expectDefined(resumedItem.id) },
          "done",
          { version: resumed.section.version },
        ),
        testData.lead.id,
      );
      expect(done.section.items[0]).toMatchObject({
        stableId: planned.stableId,
        type: "current",
        workflowStatus: "done",
      });
      await publish(period5);

      const period6 = await createOutcomePeriod(prisma, testData, 6);
      const terminalCarry = await carry.executeCarryOver(
        period5.report.id,
        period6.report.id,
      );
      expect(terminalCarry.execution.carriedItemCount).toBe(0);
      const finalHistory = await leadForm.getOpenWork(
        { reportId: period6.report.id, limit: 10 },
        testData.lead.id,
      );
      const latest = finalHistory.occurrences.find(
        (entry) => entry.item.stableId === planned.stableId,
      );
      expect(latest).toMatchObject({
        reportId: period5.report.id,
        item: { workflowStatus: "done" },
      });

      for (const [reportId, snapshot] of snapshots) {
        await expect(
          prisma.report.findUniqueOrThrow({
            where: { id: reportId },
            select: { publishedSnapshot: true },
          }),
        ).resolves.toEqual({ publishedSnapshot: snapshot });
      }
    },
  );
});
