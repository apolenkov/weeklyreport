import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { MyHistorySectionRow } from "../domain/my-history.js";

export function queryMyHistoryRows(
  prisma: PrismaService,
  authorId: string,
): Promise<readonly MyHistorySectionRow[]> {
  return prisma.reportSection.findMany({
    where: { authorId },
    // Period chronology (not row createdAt); createdAt is only the tiebreak.
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
