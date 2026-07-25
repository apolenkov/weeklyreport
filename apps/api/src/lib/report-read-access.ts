import type { UserSession } from "@customreport/shared";

import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "./group-scope.js";

// Per-request group-scope re-check — not a stored grant (e.g. export job
// requestedBy), so revoked ViewerGroupAccess cannot keep reading bytes.
// Admin bypasses scope; empty scope collapses to zero-row deny.
/**
 * Can Read Report.
 * @param session - The session argument.
 * @param reportId - The reportId argument.
 * @param prisma - The prisma argument.
 */
export async function canReadReport(
  session: UserSession,
  reportId: string,
  prisma: PrismaService,
): Promise<boolean> {
  if (session.role === "admin") {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true },
    });
    return report !== null;
  }

  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      sections: { some: groupScopeFilter(session, "reportSection") },
    },
    select: { id: true },
  });
  return report !== null;
}
