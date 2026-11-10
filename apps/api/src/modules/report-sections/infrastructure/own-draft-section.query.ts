import type { Prisma } from "@prisma/client";
import {
  mapPrismaToAuthorReportSection,
  reportSectionFullInclude,
} from "@weeklyreport/report-persistence";
import type { AuthorReportSectionReadModel } from "@weeklyreport/shared";

import { privateDraftOwnerWhere } from "./private-draft-entitlement.js";

/**
 * The actor's own section of a report with its unfinished risks and
 * decisions (openspec: lead-retained-incomplete-records, "Private draft
 * entitlement is consistent across own reads"). Authorship, active status and
 * authoring role are part of the statement that selects the section, so a
 * demoted or deactivated author gets null and keeps the complete read.
 */
export async function queryOwnDraftSection(
  prisma: Prisma.TransactionClient,
  reportId: string,
  actorId: string,
): Promise<AuthorReportSectionReadModel | null> {
  const row = await prisma.reportSection.findFirst({
    where: { reportId, ...privateDraftOwnerWhere(actorId) },
    include: reportSectionFullInclude,
  });
  return row ? mapPrismaToAuthorReportSection(row) : null;
}
