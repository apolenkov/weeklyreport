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
      candidates.itemStableIds.length > 0
        ? prisma.item.findMany({
            where: {
              stableId: { in: [...candidates.itemStableIds] },
              reportSectionId: { not: candidates.reportSectionId },
              reportSection: { report: PUBLISHED_REPORT_FILTER },
            },
            select: { stableId: true },
          })
        : Promise.resolve([]),
      candidates.decisionStableIds.length > 0
        ? prisma.decision.findMany({
            where: {
              stableId: { in: [...candidates.decisionStableIds] },
              reportSectionId: { not: candidates.reportSectionId },
              reportSection: { report: PUBLISHED_REPORT_FILTER },
            },
            select: { stableId: true },
          })
        : Promise.resolve([]),
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
