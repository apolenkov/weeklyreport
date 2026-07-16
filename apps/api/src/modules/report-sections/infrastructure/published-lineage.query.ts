import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  EMPTY_PUBLISHED_LINEAGE,
  type LineageCandidates,
  type PublishedLineage,
  resolvePublishedLineage,
  snapshotLineageAllSections,
  snapshotLineageForSection,
} from "../application/published-lineage.js";

const PUBLISHED_REPORT_FILTER = {
  OR: [{ periodStatus: "published" as const }, { archived: true }],
};

function queryPublishedItems(
  prisma: PrismaService,
  candidates: LineageCandidates,
) {
  if (candidates.itemStableIds.length === 0) return Promise.resolve([]);
  return prisma.item.findMany({
    where: {
      stableId: { in: [...candidates.itemStableIds] },
      reportSectionId: { not: candidates.reportSectionId },
      reportSection: { report: PUBLISHED_REPORT_FILTER },
    },
    select: { stableId: true },
  });
}

function queryPublishedDecisions(
  prisma: PrismaService,
  candidates: LineageCandidates,
) {
  if (candidates.decisionStableIds.length === 0) return Promise.resolve([]);
  return prisma.decision.findMany({
    where: {
      stableId: { in: [...candidates.decisionStableIds] },
      reportSectionId: { not: candidates.reportSectionId },
      reportSection: { report: PUBLISHED_REPORT_FILTER },
    },
    select: { stableId: true },
  });
}

export async function queryPublishedLineage(
  prisma: PrismaService,
  candidates: LineageCandidates,
): Promise<PublishedLineage> {
  if (
    candidates.itemStableIds.length === 0 &&
    candidates.decisionStableIds.length === 0
  ) {
    return EMPTY_PUBLISHED_LINEAGE;
  }

  const [ownReport, publishedItems, publishedDecisions, reopenedReports] =
    await Promise.all([
      prisma.report.findUnique({
        where: { id: candidates.reportId },
        select: { publishedSnapshot: true },
      }),
      queryPublishedItems(prisma, candidates),
      queryPublishedDecisions(prisma, candidates),
      prisma.report.findMany({
        where: {
          id: { not: candidates.reportId },
          periodStatus: "reopened",
        },
        select: { publishedSnapshot: true },
      }),
    ]);

  return resolvePublishedLineage(candidates, [
    snapshotLineageForSection(
      ownReport?.publishedSnapshot,
      candidates.reportSectionId,
    ),
    {
      itemStableIds: publishedItems.map((row) => row.stableId),
      decisionStableIds: publishedDecisions.map((row) => row.stableId),
    },
    ...reopenedReports.map((report) =>
      snapshotLineageAllSections(report.publishedSnapshot),
    ),
  ]);
}
