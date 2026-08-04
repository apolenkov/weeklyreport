import type { ReportSectionReadModel } from "@customreport/shared";
import { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { ReopenEligibilityFacts } from "../domain/lead-form-shared";
import { reportSectionFullInclude } from "./report-sections.include";
import { mapPrismaToReportSection } from "./report-sections.mappers";

// Shared Prisma include for `getSectionForPeriod` and its group-scoped twin —
// one contract, so a query change (e.g. a new reopen-lifecycle field) lands in
// both reads together.
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

// Shared mapping for `getSectionForPeriod` and its group-scoped twin — both
// share `sectionForPeriodInclude`, so the row shape and derived
// `readOnly`/`reopenFacts` are computed exactly once.
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

// Atomic head cross-author read: the group predicate is folded into this one
// `findFirst`, so membership + section come from a single snapshot, closing the
// reassignment race a separate assertHeadTargetInGroup pre-check leaves open.
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
