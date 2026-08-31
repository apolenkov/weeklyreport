import type { UserSession } from "@customreport/shared";

import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../lib/group-scope.js";
import {
  canReadPublishedSnapshot,
  requirePublishedSnapshot,
} from "../modules/report-sections/index.js";

// Per-request group-scope re-check — not a stored grant (e.g. export job
// requestedBy), so revoked ViewerGroupAccess cannot keep reading bytes.
export async function canReadReport(
  session: UserSession,
  reportId: string,
  prisma: PrismaService,
): Promise<boolean> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      periodStatus: true,
      publishedSnapshot: true,
    },
  });
  if (report === null) return false;

  if (report.status === "published" && report.periodStatus === "published") {
    const snapshot = requirePublishedSnapshot(
      report.publishedSnapshot,
      report.id,
    );
    return canReadPublishedSnapshot(snapshot, session);
  }

  if (session.role === "admin") return true;

  const visibleLiveReport = await prisma.report.findFirst({
    where: {
      id: reportId,
      sections: { some: groupScopeFilter(session, "reportSection") },
    },
    select: { id: true },
  });
  return visibleLiveReport !== null;
}
