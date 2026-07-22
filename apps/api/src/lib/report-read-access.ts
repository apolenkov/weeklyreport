import type { UserSession } from "@customreport/shared";

import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "./group-scope.js";

/**
 * Authorizes on the same group-scope read the report surfaces apply,
 * re-evaluated per request — never on a stored grant such as an export job's
 * `requestedBy`, which is baked into the row and would let a viewer keep
 * pulling bytes after their `ViewerGroupAccess` is revoked.
 *
 * Reuses `groupScopeFilter`: a caller is authorized when the report has at
 * least one section authored within the caller's group scope. A viewer with
 * no (or revoked) access collapses to the `{ id: { in: [] } }` zero-row
 * filter, so no section matches and access is denied — mirroring the empty
 * report the read path serves such a viewer. `admin` reads any report.
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
