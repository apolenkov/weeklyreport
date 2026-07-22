import type { UserSession } from "@customreport/shared";

import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "./group-scope.js";

/**
 * Checks current report visibility using the canonical group-scope policy.
 * Admins may read any existing report; other roles need an in-scope section.
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
