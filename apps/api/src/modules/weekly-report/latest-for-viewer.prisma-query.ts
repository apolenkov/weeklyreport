import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { WeeklyReportScopeSession } from "./weekly-report.service.js";
import { historySectionScope } from "./weekly-report-portfolio.js";

/**
 * `getVisibleReportId` / `getLatestPublishedVisibleId` queries, split out of
 * `WeeklyReportPrismaRepository` to keep that file under the line budget.
 */

// viewer-live-status (task 1.1): resolve the exact-id visibility check for
// the current editable period — MUST NOT search older editable periods, the
// gate authorizes only the current editable id.
export async function queryVisibleReportId(
  prisma: PrismaService,
  reportId: string,
  session: WeeklyReportScopeSession,
): Promise<string | null> {
  const sectionScope = historySectionScope(session);
  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      sections: { some: sectionScope },
    },
    select: { id: true },
  });
  return report?.id ?? null;
}

// Fallback: newest visible published report. `id desc` is a deterministic
// tiebreak so two published reports sharing a `periodStart` resolve to a
// stable id (same rationale as getCurrentEditableId — Decision 3).
export async function queryLatestPublishedVisibleId(
  prisma: PrismaService,
  session: WeeklyReportScopeSession,
): Promise<string | null> {
  const sectionScope = historySectionScope(session);
  const report = await prisma.report.findFirst({
    where: {
      periodStatus: "published" as const,
      sections: { some: sectionScope },
    },
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return report?.id ?? null;
}
