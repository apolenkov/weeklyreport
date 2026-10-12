import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  DraftSavePayload,
  ReportSectionReadModel,
  ResolvePlanInput,
} from "@weeklyreport/shared";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import type { seedTestData } from "../../../test-utils/prisma-test-helper.js";
import { buildTransition } from "../../period/index.js";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../index.js";

type TestData = Awaited<ReturnType<typeof seedTestData>>;

export const OUTCOME_STAGE = {
  id: "a1000000-0000-4000-a000-000000000001",
  name: "Item outcome fixture",
} as const;

export const OUTCOME_CASES = (["current", "prior"] as const).flatMap(
  (sourceKind) =>
    (
      [
        {
          outcome: "done",
          currentType: "current",
          currentStatus: "done",
          priorType: "current",
          priorStatus: "done",
        },
        {
          outcome: "continue",
          currentType: "current",
          currentStatus: "in_progress",
          priorType: "current",
          priorStatus: "in_progress",
        },
        {
          outcome: "plan_next",
          currentType: "current",
          currentStatus: "in_progress",
          priorType: "next",
          priorStatus: "planned",
        },
        {
          outcome: "wont_do",
          currentType: "current",
          currentStatus: "in_progress",
          priorType: "next",
          priorStatus: "planned",
        },
      ] as const
    ).map((expected) => ({ sourceKind, ...expected })),
);

export async function assignOutcomeStage(
  prisma: PrismaClient,
  testData: TestData,
): Promise<void> {
  await prisma.stage.create({
    data: { id: OUTCOME_STAGE.id, name: OUTCOME_STAGE.name, sortOrder: 3 },
  });
  await prisma.stageAssignment.create({
    data: {
      userId: testData.lead.id,
      stageId: OUTCOME_STAGE.id,
      projectId: testData.project.id,
    },
  });
}

export function seedOutcomeItem(
  prisma: PrismaClient,
  input: {
    readonly sectionId: string;
    readonly projectId: string;
    readonly stableId?: string;
    readonly type?: "current" | "next";
    readonly workflowStatus?:
      "planned" | "in_progress" | "paused" | "postponed" | "done";
    readonly text?: string;
  },
) {
  const type = input.type ?? "current";
  return prisma.item.create({
    data: {
      reportSectionId: input.sectionId,
      projectId: input.projectId,
      ...(input.stableId === undefined ? {} : { stableId: input.stableId }),
      type,
      text: input.text ?? "Outcome source",
      tag: "delivery",
      workflowStatus:
        input.workflowStatus ?? (type === "next" ? "planned" : "in_progress"),
      carriedOver: false,
      priorityRank: 1,
      stageNames: [OUTCOME_STAGE.name],
    },
  });
}

export async function publishReportFixture(
  prisma: PrismaClient,
  input: {
    readonly reportId: string;
    readonly sectionId: string;
    readonly authorId: string;
    readonly groupId: string;
  },
): Promise<Prisma.InputJsonValue> {
  const publishedAt = new Date("2026-12-31T18:00:00.000Z");
  await prisma.reportSection.update({
    where: { id: input.sectionId },
    data: { status: "submitted", submittedAt: publishedAt },
  });
  const candidate = await prisma.report.findUniqueOrThrow({
    where: { id: input.reportId },
    include: reportFullIncludeForSnapshot,
  });
  const snapshot = toPublishedSnapshotJson(
    buildAssembledReportFromPrismaRow({
      ...candidate,
      status: "published",
      publishedAt,
    }),
  );
  await prisma.$transaction([
    prisma.report.update({
      where: { id: input.reportId },
      data: {
        ...buildTransition("autoPublish", { now: publishedAt }),
        publishedSnapshot: snapshot,
      },
    }),
    prisma.publishedSectionScope.create({
      data: {
        reportId: input.reportId,
        reportSectionId: input.sectionId,
        authorId: input.authorId,
        groupId: input.groupId,
      },
    }),
  ]);
  return snapshot;
}

export async function seedPriorPlan(prisma: PrismaClient, testData: TestData) {
  const report = await prisma.report.create({
    data: {
      periodStart: new Date("2026-03-31T00:00:00.000Z"),
      periodEnd: new Date("2026-04-06T00:00:00.000Z"),
      deadline: new Date("2026-04-05T18:00:00.000Z"),
    },
  });
  const section = await prisma.reportSection.create({
    data: { reportId: report.id, authorId: testData.lead.id },
  });
  const item = await seedOutcomeItem(prisma, {
    sectionId: section.id,
    projectId: testData.project.id,
    type: "next",
    workflowStatus: "planned",
    text: "Published prior promise",
  });
  const snapshot = await publishReportFixture(prisma, {
    reportId: report.id,
    sectionId: section.id,
    authorId: testData.lead.id,
    groupId: expectDefined(testData.lead.reportingGroupId),
  });
  await prisma.item.update({
    where: { id: item.id },
    data: { text: "Drifted live row", workflowStatus: "postponed" },
  });
  return { report, section, item, snapshot };
}

export async function prepareOutcomeSource(
  prisma: PrismaClient,
  testData: TestData,
  kind: "current" | "prior",
) {
  if (kind === "current") {
    const item = await seedOutcomeItem(prisma, {
      sectionId: testData.section.id,
      projectId: testData.project.id,
    });
    return {
      item,
      source: { kind, recordId: item.id } as const,
      prior: null,
    };
  }
  const prior = await seedPriorPlan(prisma, testData);
  return {
    item: prior.item,
    source: {
      kind,
      reportId: prior.report.id,
      recordId: prior.item.id,
    } as const,
    prior,
  };
}

export async function createOutcomePeriod(
  prisma: PrismaClient,
  testData: TestData,
  weekOffset: number,
) {
  const periodStart = new Date(Date.UTC(2026, 3, 7 + weekOffset * 7, 0, 0, 0));
  const periodEnd = new Date(periodStart.getTime() + 6 * 86_400_000);
  const report = await prisma.report.create({
    data: { periodStart, periodEnd },
  });
  const section = await prisma.reportSection.create({
    data: { reportId: report.id, authorId: testData.lead.id },
  });
  return { report, section };
}

export function outcomeCommand(
  sectionId: string,
  source: ResolvePlanInput["source"],
  outcome: ResolvePlanInput["outcome"],
  overrides: Partial<ResolvePlanInput> = {},
): ResolvePlanInput {
  return {
    reportSectionId: sectionId,
    version: 1,
    commandId: crypto.randomUUID(),
    source,
    outcome,
    ...(outcome === "plan_next" && source.kind === "current"
      ? { text: "Verify the next-period metrics" }
      : {}),
    ...(outcome === "wont_do" ? { reason: "The dependency was retired." } : {}),
    ...overrides,
  };
}

export function unchangedDraftPayload(
  section: ReportSectionReadModel,
): DraftSavePayload {
  return {
    reportSectionId: section.reportSectionId,
    version: section.version,
    status: "draft",
    projectStatuses: section.projects.map((project) => ({
      projectId: project.projectId,
      status: project.trafficLight ?? undefined,
    })),
    stageStatuses: section.projects.flatMap((project) =>
      project.ownedStages.map((stage) => ({
        projectId: project.projectId,
        stageId: stage.stageId,
        status: stage.status,
      })),
    ),
    activityStatuses: section.activities.map((activity) => ({
      activityId: activity.activityId,
      status: activity.status,
      note: activity.note,
    })),
    items: section.items.map((item) => ({
      id: item.id,
      stableId: item.stableId,
      projectId: item.projectId,
      activityId: item.activityId,
      type: item.type,
      text: item.text,
      tag: item.tag,
      workflowStatus: item.workflowStatus,
      carriedOver: item.carriedOver,
      priorityRank: item.priorityRank,
      pausedReason: item.pausedReason,
      nextStepText: item.nextStepText,
      stageNames: item.stageNames,
    })),
    risks: [],
    decisions: [],
  };
}
