import type { PrismaClient } from "@prisma/client";

import type { seedTestData } from "../../../test-utils/prisma-test-helper.js";
import { buildTransition } from "../../period/index.js";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../index.js";

type TestData = Awaited<ReturnType<typeof seedTestData>>;

const publishedAt = new Date("2026-07-22T12:00:00.000Z");

// Moves the target report through both governed lifecycle representations.
export async function publishTarget(
  prisma: PrismaClient,
  testData: TestData,
): Promise<void> {
  await publishReportWithSnapshot(prisma, testData.report.id);
}

async function createSourceSection(
  prisma: PrismaClient,
  testData: TestData,
): Promise<{ reportId: string; sectionId: string }> {
  const sourceReport = await prisma.report.create({
    data: {
      periodStart: new Date("2026-07-07T00:00:00.000Z"),
      periodEnd: new Date("2026-07-13T00:00:00.000Z"),
      deadline: new Date("2026-07-12T18:00:00.000Z"),
    },
  });
  const source = await prisma.reportSection.create({
    data: {
      reportId: sourceReport.id,
      authorId: testData.lead.id,
      status: "submitted",
    },
  });
  return { reportId: sourceReport.id, sectionId: source.id };
}

async function publishReportWithSnapshot(
  prisma: PrismaClient,
  reportId: string,
): Promise<void> {
  const candidate = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: reportFullIncludeForSnapshot,
  });
  const snapshot = buildAssembledReportFromPrismaRow({
    ...candidate,
    status: "published",
    publishedAt,
  });
  await prisma.report.update({
    where: { id: reportId },
    data: {
      ...buildTransition("autoPublish", { now: publishedAt }),
      publishedSnapshot: toPublishedSnapshotJson(snapshot),
    },
  });
}

function seedItems(
  prisma: PrismaClient,
  testData: TestData,
  sourceSectionId: string,
) {
  return prisma.item.createMany({
    data: [
      {
        reportSectionId: sourceSectionId,
        projectId: testData.project.id,
        type: "next",
        text: "Source item",
        tag: "plan",
        workflowStatus: "planned",
        stageNames: ["Development"],
      },
      {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "Target item",
        tag: "feature",
        workflowStatus: "in_progress",
        stageNames: ["Development"],
      },
    ],
  });
}

function seedRisks(
  prisma: PrismaClient,
  testData: TestData,
  sourceSectionId: string,
) {
  return prisma.risk.createMany({
    data: [
      {
        reportSectionId: sourceSectionId,
        projectId: testData.project.id,
        risk: "Source risk",
        impact: "High",
        mitigation: "Mitigate",
        severity: "blocked",
        stageNames: ["Development"],
      },
      {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        risk: "Target risk",
        impact: "Low",
        mitigation: "Monitor",
        severity: "at-risk",
        stageNames: ["Development"],
      },
    ],
  });
}

function seedDecisions(
  prisma: PrismaClient,
  testData: TestData,
  sourceSectionId: string,
) {
  return prisma.decision.createMany({
    data: [
      {
        reportSectionId: sourceSectionId,
        productId: testData.project.id,
        text: "Source decision",
        owner: "Lead",
        impact: "High",
        stageNames: ["Development"],
      },
      {
        reportSectionId: testData.section.id,
        productId: testData.project.id,
        text: "Target decision",
        owner: "Lead",
        impact: "Low",
        stageNames: ["Development"],
      },
    ],
  });
}

export async function seedFillRows(
  prisma: PrismaClient,
  testData: TestData,
): Promise<string> {
  const source = await createSourceSection(prisma, testData);
  await Promise.all([
    seedItems(prisma, testData, source.sectionId),
    seedRisks(prisma, testData, source.sectionId),
    seedDecisions(prisma, testData, source.sectionId),
  ]);
  await publishReportWithSnapshot(prisma, source.reportId);
  return source.sectionId;
}

export function targetRows(prisma: PrismaClient, testData: TestData) {
  const where = { reportSectionId: testData.section.id };
  return Promise.all([
    prisma.item.findMany({ where, select: { id: true, text: true } }),
    prisma.risk.findMany({ where, select: { id: true, risk: true } }),
    prisma.decision.findMany({ where, select: { id: true, text: true } }),
  ]);
}
