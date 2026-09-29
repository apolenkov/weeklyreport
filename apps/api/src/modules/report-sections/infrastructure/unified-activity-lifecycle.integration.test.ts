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
  buildAutoCarryOverDeps,
  carryOverIntoOpenedPeriod,
  CarryOverPrismaRepository,
  CarryOverService,
} from "../../carry-over/index.js";
import { LeadFormService } from "../application/lead-form.service";
import { ReportSectionsService } from "../application/report-sections.service";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../index.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

// Real-DB coverage for the unified-activity-entry lifecycle rules:
// resolve-not-delete on reopened-period saves, deletable-until-republished
// additions, carried-clone lineage locks, and move-to-next-week identity survival.
describe("unified-activity lifecycle (integration)", () => {
  const prisma = createTestPrisma();
  let repo: ReportSectionsPrismaRepository;
  let service: ReportSectionsService;
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  const stageId = "a0000000-0000-4000-a000-000000000aa1";
  const PUBLISHED_ITEM_LINEAGE = "b0000000-0000-4000-a000-000000000001";
  const DRAFT_ITEM_LINEAGE = "b0000000-0000-4000-a000-000000000002";

  async function assignLeadToProject() {
    await prisma.stage.create({
      data: { id: stageId, name: "Development", sortOrder: 3 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        stageId,
        projectId: testData.project.id,
      },
    });
  }

  function writeItem(stableId: string, text: string) {
    return {
      stableId,
      projectId: testData.project.id,
      type: "current" as const,
      text,
      tag: "feature",
      workflowStatus: "in_progress" as const,
      carriedOver: false,
      stageNames: ["Development"],
    };
  }

  // Insert a live item row carrying a known durable lineage key.
  async function seedItem(
    sectionId: string,
    stableId: string,
    text: string,
    type: "current" | "next" = "current",
  ) {
    return prisma.item.create({
      data: {
        reportSectionId: sectionId,
        stableId,
        projectId: testData.project.id,
        type,
        text,
        tag: "feature",
        workflowStatus: type === "next" ? "planned" : "in_progress",
        carriedOver: false,
        stageNames: ["Development"],
      },
    });
  }

  async function publishCurrentReport(): Promise<void> {
    const publishedAt = new Date("2026-04-14T10:00:00.000Z");
    const candidate = await prisma.report.findUniqueOrThrow({
      where: { id: testData.report.id },
      include: reportFullIncludeForSnapshot,
    });
    const snapshot = buildAssembledReportFromPrismaRow({
      ...candidate,
      status: "published",
      publishedAt,
    });
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt,
        publishedSnapshot: toPublishedSnapshotJson(snapshot),
      },
    });
  }

  // Publish-then-reopen the seeded report: the complete frozen snapshot pins
  // the published lineage while the live rows become editable again.
  async function publishThenReopen(): Promise<void> {
    await publishCurrentReport();
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        periodState: "open",
        periodStatus: "reopened",
        reopenedAt: new Date("2026-04-15T10:00:00.000Z"),
      },
    });
  }

  beforeAll(() => {
    repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );
    service = new ReportSectionsService(repo);
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    await assignLeadToProject();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("rejects dropping a published-lineage item from a reopened period", async () => {
    await seedItem(testData.section.id, PUBLISHED_ITEM_LINEAGE, "Published");
    await publishThenReopen();

    await expect(
      service.saveDraft(
        {
          reportSectionId: testData.section.id,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [
            { projectId: testData.project.id, status: "green" },
          ],
          items: [],
          risks: [],
          decisions: [],
        },
        testData.lead.id,
      ),
    ).rejects.toMatchObject({ code: "PUBLISHED_RECORD_LOCKED" });

    // The live row is untouched — the reject happened before the recreate.
    const items = await prisma.item.findMany({
      where: { reportSectionId: testData.section.id },
    });
    expect(items.map((item) => item.stableId)).toEqual([
      PUBLISHED_ITEM_LINEAGE,
    ]);
  });

  it("a record added after reopen stays deletable until re-published", async () => {
    await seedItem(testData.section.id, PUBLISHED_ITEM_LINEAGE, "Published");
    await publishThenReopen();

    // Add a fresh record post-reopen (not in the snapshot), then drop it.
    const withDraft = await service.saveDraft(
      {
        reportSectionId: testData.section.id,
        version: 1,
        status: "draft",
        stageStatuses: [],
        activityStatuses: [],
        projectStatuses: [{ projectId: testData.project.id, status: "green" }],
        items: [
          writeItem(PUBLISHED_ITEM_LINEAGE, "Published"),
          writeItem(DRAFT_ITEM_LINEAGE, "Added after reopen"),
        ],
        risks: [],
        decisions: [],
      },
      testData.lead.id,
    );
    expect(withDraft.items).toHaveLength(2);

    const afterDelete = await service.saveDraft(
      {
        reportSectionId: testData.section.id,
        version: withDraft.version,
        status: "draft",
        stageStatuses: [],
        activityStatuses: [],
        projectStatuses: [{ projectId: testData.project.id, status: "green" }],
        items: [writeItem(PUBLISHED_ITEM_LINEAGE, "Published")],
        risks: [],
        decisions: [],
      },
      testData.lead.id,
    );
    expect(afterDelete.items.map((item) => item.stableId)).toEqual([
      PUBLISHED_ITEM_LINEAGE,
    ]);
  });

  it("a carried clone of a published record stays locked by lineage in the new period", async () => {
    // The prior period holds the lineage and is frozen-published.
    await seedItem(testData.section.id, PUBLISHED_ITEM_LINEAGE, "Origin");
    await publishCurrentReport();

    // A new open period holds the carried clone (same stableId, new row).
    const nextReport = await prisma.report.create({
      data: {
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
      },
    });
    const nextSection = await prisma.reportSection.create({
      data: {
        reportId: nextReport.id,
        authorId: testData.lead.id,
        status: "draft",
      },
    });
    await seedItem(nextSection.id, PUBLISHED_ITEM_LINEAGE, "Carried clone");

    await expect(
      service.saveDraft(
        {
          reportSectionId: nextSection.id,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [
            { projectId: testData.project.id, status: "green" },
          ],
          items: [],
          risks: [],
          decisions: [],
        },
        testData.lead.id,
      ),
    ).rejects.toMatchObject({ code: "PUBLISHED_RECORD_LOCKED" });
  });

  it("a carried clone stays locked while its SOURCE period is reopened", async () => {
    // The prior period holds the lineage and is REOPENED (a reopened period was
    // published before, so its live rows still continue a published lineage).
    await seedItem(testData.section.id, PUBLISHED_ITEM_LINEAGE, "Origin");
    await publishThenReopen();

    // A new open period holds the carried clone (same stableId, new row).
    const nextReport = await prisma.report.create({
      data: {
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
      },
    });
    const nextSection = await prisma.reportSection.create({
      data: {
        reportId: nextReport.id,
        authorId: testData.lead.id,
        status: "draft",
      },
    });
    await seedItem(nextSection.id, PUBLISHED_ITEM_LINEAGE, "Carried clone");

    // Without `reopened` in the cross-report lineage filter this would resolve
    // to an empty lineage and the drop would succeed.
    await expect(
      service.saveDraft(
        {
          reportSectionId: nextSection.id,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [
            { projectId: testData.project.id, status: "green" },
          ],
          items: [],
          risks: [],
          decisions: [],
        },
        testData.lead.id,
      ),
    ).rejects.toMatchObject({ code: "PUBLISHED_RECORD_LOCKED" });
  });

  it("move-to-next-week keeps the durable identity and its comment anchor", async () => {
    const row = await seedItem(
      testData.section.id,
      PUBLISHED_ITEM_LINEAGE,
      "Item with feedback",
    );
    await prisma.recordComment.create({
      data: {
        reviewerId: testData.head.id,
        itemId: row.id,
        text: "Please split this into two tasks",
      },
    });

    // The move action writes the same stableId with type flipped in place.
    const moved = await service.saveDraft(
      {
        reportSectionId: testData.section.id,
        version: 1,
        status: "draft",
        stageStatuses: [],
        activityStatuses: [],
        projectStatuses: [{ projectId: testData.project.id, status: "green" }],
        items: [
          {
            ...writeItem(PUBLISHED_ITEM_LINEAGE, "Item with feedback"),
            type: "next" as const,
            workflowStatus: "planned" as const,
          },
        ],
        risks: [],
        decisions: [],
      },
      testData.lead.id,
    );

    const movedItem = expectDefined(moved.items[0]);
    expect(movedItem.stableId).toBe(PUBLISHED_ITEM_LINEAGE);
    expect(movedItem.type).toBe("next");

    // The comment re-anchored onto the recreated row via the lineage key.
    const comments = await prisma.recordComment.findMany({
      where: { item: { reportSectionId: testData.section.id } },
    });
    expect(comments).toHaveLength(1);
    expect(comments[0]?.text).toBe("Please split this into two tasks");
  });

  it("fill-from is rejected when the target holds a published-lineage record", async () => {
    await seedItem(testData.section.id, PUBLISHED_ITEM_LINEAGE, "Published");
    await publishThenReopen();

    // A source section owned by the same lead; its content is irrelevant — the
    // lock fires on the TARGET's lineage before the source is read. The prior
    // week must be distinct (unique-constrained), or the create 500s first.
    const sourceReport = await prisma.report.create({
      data: {
        periodStart: new Date("2026-03-31"),
        periodEnd: new Date("2026-04-06"),
        deadline: new Date("2026-04-04"),
        status: "draft",
      },
    });
    const sourceSection = await prisma.reportSection.create({
      data: {
        reportId: sourceReport.id,
        authorId: testData.lead.id,
        status: "draft",
      },
    });

    const leadService = new LeadFormService(
      new LeadFormPrismaRepository(prisma as unknown as PrismaService),
    );

    await expect(
      leadService.fillFrom(
        testData.section.id,
        sourceSection.id,
        testData.lead.id,
        1,
      ),
    ).rejects.toMatchObject({ code: "PUBLISHED_RECORD_LOCKED" });

    // The published live row is untouched — the reject is fail-closed.
    const items = await prisma.item.findMany({
      where: { reportSectionId: testData.section.id },
    });
    expect(items.map((item) => item.stableId)).toEqual([
      PUBLISHED_ITEM_LINEAGE,
    ]);
  });

  it("a carried item advances to the following period each week", async () => {
    // Period N: one next-week item (carryable), then publish.
    await seedItem(
      testData.section.id,
      PUBLISHED_ITEM_LINEAGE,
      "Plan work",
      "next",
    );
    await publishCurrentReport();

    const carryService = new CarryOverService(
      new CarryOverPrismaRepository(prisma as unknown as PrismaService),
    );

    // Period N+1: carry forward → arrives carriedOver=true, type=current.
    const reportN1 = await prisma.report.create({
      data: {
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
      },
    });
    const sectionN1 = await prisma.reportSection.create({
      data: {
        reportId: reportN1.id,
        authorId: testData.lead.id,
        status: "draft",
      },
    });
    await carryService.executeCarryOver(testData.report.id, reportN1.id);

    const carried = expectDefined(
      await prisma.item.findFirst({
        where: {
          reportSectionId: sectionN1.id,
          stableId: PUBLISHED_ITEM_LINEAGE,
        },
      }),
    );
    expect(carried.carriedOver).toBe(true);
    expect(carried.type).toBe("current");

    // The lead moves it to next week (moveToNextWeekPatch via saveSection):
    // persisted as type=next, workflowStatus in the next vocabulary,
    // carriedOver=false, durable identity preserved.
    await prisma.item.update({
      where: { id: carried.id },
      data: { type: "next", workflowStatus: "planned", carriedOver: false },
    });

    // Period N+2: carry again → the moved item continues. It would be silently
    // lost here if the move had left carriedOver=true.
    const reportN2 = await prisma.report.create({
      data: {
        periodStart: new Date("2026-04-21"),
        periodEnd: new Date("2026-04-27"),
        deadline: new Date("2026-04-25"),
        status: "draft",
      },
    });
    await prisma.reportSection.create({
      data: {
        reportId: reportN2.id,
        authorId: testData.lead.id,
        status: "draft",
      },
    });
    await carryService.executeCarryOver(reportN1.id, reportN2.id);

    const inN2 = await prisma.item.findFirst({
      where: {
        reportSection: { reportId: reportN2.id },
        stableId: PUBLISHED_ITEM_LINEAGE,
      },
    });
    expect(inN2).not.toBeNull();
    expect(inN2?.carriedOver).toBe(true);
  });

  it("auto carry-over materializes the section, carries only open work, and never duplicates", async () => {
    // Prior period: one open next-week item, one unresolved decision, one done item.
    await seedItem(
      testData.section.id,
      PUBLISHED_ITEM_LINEAGE,
      "Open planned work",
      "next",
    );
    await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "Done work",
        tag: "feature",
        workflowStatus: "done",
        carriedOver: false,
        stageNames: ["Development"],
      },
    });
    await prisma.decision.create({
      data: {
        reportSectionId: testData.section.id,
        productId: testData.project.id,
        text: "Pending decision",
        owner: "Head",
        impact: "High",
        stageNames: ["Development"],
      },
    });
    await publishCurrentReport();

    // The lead's target section is deliberately NOT pre-created: the
    // orchestrator must materialize it via ensureLeadSection.
    const nextReport = await prisma.report.create({
      data: {
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
      },
    });

    const repository = new CarryOverPrismaRepository(
      prisma as unknown as PrismaService,
    );
    const deps = buildAutoCarryOverDeps({
      prisma,
      repository,
      carryOverService: new CarryOverService(repository),
      logger: { info: () => undefined, warn: () => undefined },
    });
    await carryOverIntoOpenedPeriod(deps, nextReport.id);

    // The section was materialized and only the open records moved: the done
    // item stays behind, the carried item is flagged, the decision is open.
    const targetItems = await prisma.item.findMany({
      where: { reportSection: { reportId: nextReport.id } },
    });
    expect(targetItems.map((item) => item.text)).toEqual(["Open planned work"]);
    expect(targetItems.at(0)?.carriedOver).toBe(true);
    const targetDecisions = await prisma.decision.findMany({
      where: { reportSection: { reportId: nextReport.id } },
    });
    expect(targetDecisions.map((decision) => decision.text)).toEqual([
      "Pending decision",
    ]);
    expect(targetDecisions.at(0)?.resolvedAt).toBeNull();

    // A second run (second login, next scheduler tick) duplicates nothing.
    await carryOverIntoOpenedPeriod(deps, nextReport.id);
    const afterRerunItems = await prisma.item.count({
      where: { reportSection: { reportId: nextReport.id } },
    });
    const afterRerunDecisions = await prisma.decision.count({
      where: { reportSection: { reportId: nextReport.id } },
    });
    expect(afterRerunItems).toBe(1);
    expect(afterRerunDecisions).toBe(1);
  });
});
