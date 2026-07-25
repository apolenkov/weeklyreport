import type { ReportSectionReadModel } from "@customreport/shared";
import { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { ReopenEligibilityFacts } from "../domain/lead-form-shared";
import { reportSectionFullInclude } from "./report-sections.include";
import { mapPrismaToReportSection } from "./report-sections.mappers";

/**
 * Shared Prisma include for `getSectionForPeriod` and its group-scoped twin
 * `getSectionForPeriodAsGroupPeer` — one contract, so a query change (e.g. a
 * new reopen-lifecycle field) lands in both reads together.
 */
const sectionForPeriodInclude = {
  ...reportSectionFullInclude,
  report: { select: { periodStatus: true, archived: true } },
  // Does this section already hold a pending reopen request? Drives
  // `canRequestReopen` (one-pending rule).
  reopenRequests: {
    where: { status: "pending" },
    select: { id: true },
    take: 1,
  },
} as const satisfies Prisma.ReportSectionInclude;

type SectionForPeriodRow = Prisma.ReportSectionGetPayload<{
  include: typeof sectionForPeriodInclude;
}>;

export interface SectionForPeriodResult {
  section: ReportSectionReadModel;
  readOnly: boolean;
  reopenFacts: ReopenEligibilityFacts;
}

/**
 * Shared mapping for `getSectionForPeriod` and `getSectionForPeriodAsGroupPeer`
 * — both queries share the same `sectionForPeriodInclude`, so the row shape
 * and the derived `readOnly`/`reopenFacts` are computed exactly once.
 */
function mapSectionForPeriodRow(
  row: SectionForPeriodRow,
): SectionForPeriodResult {
  const section = mapPrismaToReportSection(row);
  const { report, reopenRequests } = row;

  // A 'reopened' period is editable again (the whole point of the state), so
  // it is read-write alongside 'open'. 'published'/'archived' stay read-only.
  const readOnly =
    report.periodStatus !== "open" && report.periodStatus !== "reopened";

  const reopenFacts: ReopenEligibilityFacts = {
    sectionStatus: section.status,
    periodStatus: report.periodStatus,
    archived: report.archived,
    hasPendingReopen: reopenRequests.length > 0,
  };

  return { section, readOnly, reopenFacts };
}

/**
 * Get Section For Period.
 * @param prisma - The prisma argument.
 * @param reportId - The reportId argument.
 * @param userId - The userId argument.
 */
export async function getSectionForPeriod(
  prisma: PrismaService,
  reportId: string,
  userId: string,
): Promise<SectionForPeriodResult | null> {
  const row = await prisma.reportSection.findUnique({
    where: { reportId_authorId: { reportId, authorId: userId } },
    include: sectionForPeriodInclude,
  });

  if (!row) {
    return null;
  }

  return mapSectionForPeriodRow(row);
}

/**
 * Atomic head cross-author read: returns the section only if, in the SAME
 * query snapshot, the author's reporting group currently contains
 * `peerUserId`. `assertHeadTargetInGroup` (two separate group lookups) stays
 * the fast pre-check for a clear 403 message, but it reads the group
 * membership in a separate statement — a concurrent reassignment between
 * that check and an unscoped section read could slip a cross-group section
 * through. Folding the group predicate into this one `findFirst` closes that
 * window: the membership and the section come from one atomic read, so
 * there is no gap for the group to change in. A peer with no reporting group
 * (`reportingGroupId: null`) fails the relation filter and yields null —
 * fail closed with no separate null-check needed.
  * @param prisma - The prisma argument.
 * @param reportId - The reportId argument.
 * @param authorId - The authorId argument.
 * @param peerUserId - The peerUserId argument.
 */
export async function getSectionForPeriodAsGroupPeer(
  prisma: PrismaService,
  reportId: string,
  authorId: string,
  peerUserId: string,
): Promise<SectionForPeriodResult | null> {
  const row = await prisma.reportSection.findFirst({
    where: {
      reportId,
      authorId,
      author: { reportingGroup: { users: { some: { id: peerUserId } } } },
    },
    include: sectionForPeriodInclude,
  });

  if (!row) {
    return null;
  }

  return mapSectionForPeriodRow(row);
}

/**
 * Get Section Reopen Context.
 * @param prisma - The prisma argument.
 * @param sectionId - The sectionId argument.
 */
export async function getSectionReopenContext(
  prisma: PrismaService,
  sectionId: string,
): Promise<{ authorId: string; facts: ReopenEligibilityFacts } | null> {
  const row = await prisma.reportSection.findUnique({
    where: { id: sectionId },
    select: {
      authorId: true,
      status: true,
      report: { select: { periodStatus: true, archived: true } },
      reopenRequests: {
        where: { status: "pending" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!row) {
    return null;
  }

  return {
    authorId: row.authorId,
    facts: {
      sectionStatus: row.status,
      periodStatus: row.report.periodStatus,
      archived: row.report.archived,
      hasPendingReopen: row.reopenRequests.length > 0,
    },
  };
}
