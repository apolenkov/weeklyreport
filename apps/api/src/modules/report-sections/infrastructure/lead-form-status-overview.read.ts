import type { Role } from "@customreport/shared";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { StatusOverviewPeriodRead } from "../domain/lead-form-shared.js";
import { resolveStatusOverviewPredecessor } from "./lead-form-status-overview.predecessor.js";

/**
 * Reads only the selected period identity and the immediately earlier report.
 * Snapshot content wins; live fallback is accepted only from a submitted,
 * object-authorized section.
 */
export function getStatusOverviewPeriodsRead(
  prisma: PrismaService,
  reportId: string,
  authorId: string,
  viewerId: string,
  role: Role,
): Promise<StatusOverviewPeriodRead | null> {
  return prisma.$transaction(
    async (tx) => {
      const current = await tx.report.findUnique({
        where: { id: reportId },
        select: { id: true, periodStart: true, periodEnd: true },
      });
      if (!current) return null;

      const predecessor = await tx.report.findFirst({
        where: { periodStart: { lt: current.periodStart } },
        orderBy: [
          { periodStart: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          publishedSnapshot: true,
          publishedSectionScopes: {
            where: { authorId: { in: [authorId, viewerId] } },
            select: {
              authorId: true,
              reportSectionId: true,
              groupId: true,
            },
          },
        },
      });
      const currentPeriod = {
        reportId: current.id,
        periodStart: current.periodStart,
        periodEnd: current.periodEnd,
      };
      if (!predecessor) {
        return {
          current: currentPeriod,
          predecessor: {
            availability: "unavailable",
            reason: "no_predecessor",
          },
        };
      }

      return {
        current: currentPeriod,
        predecessor: await resolveStatusOverviewPredecessor(
          tx,
          predecessor,
          authorId,
          viewerId,
          role,
        ),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
