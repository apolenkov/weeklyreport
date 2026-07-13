import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { CompiledHistoryReportRow } from "./compiled-history.js";
import type { WeeklyReportScopeSession } from "./weekly-report.service.js";
import { historySectionScope } from "./weekly-report-portfolio.js";

/**
 * `getCompiledHistory` query, split out of `WeeklyReportPrismaRepository` to
 * keep that file under the line budget.
 */
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
  // viewer-live-status (task 3.1 / Decision 5): the viewer read gate is
  // published-or-current, so a reopened period (legacy `status="published"`,
  // `periodStatus="reopened"`) would otherwise be listed in the viewer's
  // History as a gate-rejected broken link. Narrow the VIEWER History to
  // `periodStatus="published"` only. This MUST be viewer-only —
  // `compiledHistory` is a shared `anyRoleProcedure`, and an unconditional
  // filter would silently drop reopened periods from head/lead History (a
  // non-goal). Applied to BOTH `listWhere` and `archiveCountWhere` so the
  // list and the archive count agree for the viewer.
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
      take: 100,
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
