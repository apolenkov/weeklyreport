import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { CompiledHistoryReportRow } from "./compiled-history.js";
import type { WeeklyReportScopeSession } from "./weekly-report.service.js";
import { historySectionScope } from "./weekly-report-portfolio.js";

// Cap history list size; archive count is separate so the UI can still offer expand.
const COMPILED_HISTORY_PAGE_SIZE = 100;

export async function queryCompiledHistory(
  prisma: PrismaService,
  session: WeeklyReportScopeSession,
  includeArchive: boolean,
): Promise<{
  reports: readonly CompiledHistoryReportRow[];
  archiveCount: number;
}> {
  const sectionScope = historySectionScope(session);
  const visibleSectionWhere: Prisma.ReportWhereInput = {
    sections: { some: sectionScope },
  };
  // Viewer-only: reopened periods (status published, periodStatus reopened)
  // would appear as broken History links; head/lead must still see them.
  const viewerPeriodFilter: Prisma.ReportWhereInput =
    session.role === "viewer" ? { periodStatus: "published" as const } : {};
  const listWhere: Prisma.ReportWhereInput = {
    status: "published" as const,
    ...(includeArchive ? {} : { archived: false }),
    ...viewerPeriodFilter,
    ...visibleSectionWhere,
  };
  const archiveCountWhere: Prisma.ReportWhereInput = {
    status: "published" as const,
    archived: true,
    ...viewerPeriodFilter,
    ...visibleSectionWhere,
  };

  const [reports, archiveCount] = await Promise.all([
    prisma.report.findMany({
      where: listWhere,
      orderBy: { periodStart: "desc" },
      take: COMPILED_HISTORY_PAGE_SIZE,
      include: {
        publishedBy: { select: { name: true } },
        sections: {
          where: sectionScope,
          select: {
            items: {
              select: { projectId: true, priorityRank: true },
            },
            risks: { select: { projectId: true } },
            decisions: { select: { productId: true } },
            projectStatuses: {
              select: { projectId: true, status: true },
            },
            stageStatuses: { select: { projectId: true } },
          },
        },
      },
    }),
    prisma.report.count({ where: archiveCountWhere }),
  ]);

  return { reports, archiveCount };
}
