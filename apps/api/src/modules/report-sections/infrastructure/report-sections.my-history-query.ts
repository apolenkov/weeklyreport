import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { MyHistorySectionRow } from "../domain/my-history.js";

/**
 * `getMyHistoryRows` query, split out of `ReportSectionsPrismaRepository`
 * to keep that file under the line budget (mirrors `queryPublishedLineage`).
 */
export function queryMyHistoryRows(
  prisma: PrismaService,
  authorId: string,
): Promise<readonly MyHistorySectionRow[]> {
  return prisma.reportSection.findMany({
    where: { authorId },
    // Order by reporting-period chronology (newest period first), NOT by
    // the section row's insertion time — `createdAt` is unrelated to the
    // period a report covers (seeds insert in one run). This matches the
    // `compiledHistory` ordering so both reads of the history surface
    // agree, and keeps the summary-rail streak (which assumes
    // newest-period-first) honest. `createdAt` is the stable tiebreak.
    orderBy: [{ report: { periodStart: "desc" } }, { createdAt: "desc" }],
    include: {
      report: {
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          archived: true,
          publishedAt: true,
        },
      },
      items: {
        select: { projectId: true, updatedAt: true, priorityRank: true },
      },
      risks: {
        select: { projectId: true, updatedAt: true },
      },
      decisions: {
        select: { productId: true, updatedAt: true },
      },
      projectStatuses: {
        select: { projectId: true, status: true, updatedAt: true },
      },
      stageStatuses: {
        select: { projectId: true, updatedAt: true },
      },
    },
  });
}
