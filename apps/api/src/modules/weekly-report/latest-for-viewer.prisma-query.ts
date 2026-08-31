import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { currentEditableReportWhere } from "../../lib/report-lifecycle.js";
import {
  publishedReportScopeWhere,
  requirePublishedSnapshot,
  requireScopedPublishedSnapshot,
} from "../report-sections/index.js";
import type { WeeklyReportScopeSession } from "./weekly-report.service.js";
import { historySectionScope } from "./weekly-report-portfolio.js";

// Resolve the exact-id visibility check for the current editable period —
// MUST NOT search older editable periods, the gate authorizes only the
// current editable id. Reasserting the lifecycle tuple closes the race where
// the id resolver observes an editable row just before archive or publish.
export async function queryVisibleReportId(
  prisma: PrismaService,
  reportId: string,
  session: WeeklyReportScopeSession,
): Promise<string | null> {
  const sectionScope = historySectionScope(session);
  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      ...currentEditableReportWhere(),
      sections: { some: sectionScope },
    },
    select: { id: true },
  });
  return report?.id ?? null;
}

// Fallback: newest visible published report. `id desc` is a deterministic
// tiebreak so two published reports sharing a `periodStart` resolve to a
// stable id (same rationale as getCurrentEditableId).
export async function queryLatestPublishedVisibleId(
  prisma: PrismaService,
  session: WeeklyReportScopeSession,
): Promise<string | null> {
  const report = await prisma.report.findFirst({
    where: {
      periodStatus: "published" as const,
      archived: false,
      ...publishedReportScopeWhere(session, "lead-own"),
    },
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    select: { id: true, publishedSnapshot: true },
  });

  if (!report) return null;
  const snapshot = requirePublishedSnapshot(
    report.publishedSnapshot,
    report.id,
  );
  requireScopedPublishedSnapshot(snapshot, session, "lead-own");
  return report.id;
}
