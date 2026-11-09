import type { Prisma } from "@prisma/client";
import type { TrafficLightStatus } from "@weeklyreport/shared";
import {
  type AssembledReport,
  assembledReportSchema,
  buildPortfolioProductsFromSnapshotSections,
  type PortfolioOverview,
  type PublishedReportSectionReadModel,
  publishedReportSectionReadModelSchema,
  publishedReportSnapshotSchema,
  type RecordOmission,
  type ReportSectionReadModel,
} from "@weeklyreport/shared";

import { toRecordOmission } from "./mappers/report-sections.record-omission.js";
import { publishedSnapshotFailure } from "./published-snapshot.js";
import { reportSectionFullInclude } from "./report-sections.include.js";
import { mapPrismaToReportSection } from "./report-sections.mappers.js";

const reportSectionFullIncludeForSnapshot = {
  ...reportSectionFullInclude,
  author: {
    select: {
      ...reportSectionFullInclude.author.select,
      reportingGroup: { select: { id: true, name: true } },
    },
  },
} as const satisfies Prisma.ReportSectionInclude;

export const reportFullIncludeForSnapshot = {
  sections: {
    include: reportSectionFullIncludeForSnapshot,
    // Postgres collation only approximates Node/ICU localeCompare("ru") —
    // buildAssembledReportFromPrismaRow re-sorts mapped sections with that
    // comparator; this stays as a cheap pre-sort, and the id tiebreak keeps
    // shared display names stable in the sort input.
    orderBy: [{ author: { name: "asc" } }, { id: "asc" }],
  },
  publishedBy: true,
} as const satisfies Prisma.ReportInclude;

// Derived from the generated payload so this function's declared input
// finally matches what every real caller provides (each queries
// `reportFullIncludeForSnapshot` verbatim before calling this).
type SnapshotReportRow = Prisma.ReportGetPayload<{
  include: typeof reportFullIncludeForSnapshot;
}>;

function freezeSectionOwnership(
  row: SnapshotReportRow["sections"][number],
): PublishedReportSectionReadModel {
  const section = mapPrismaToReportSection(row);
  const groupId = row.author.reportingGroupId;
  const group = row.author.reportingGroup;
  if (groupId === null || group?.id !== groupId) {
    throw publishedSnapshotFailure(
      row.reportId,
      `section ${row.id} author ${row.authorId} has no consistent reporting-group ownership.`,
    );
  }

  return publishedReportSectionReadModelSchema.parse({
    ...section,
    // Reviewer reasons are for the owning lead only; never freeze them.
    reviews: section.reviews.map(({ comment: _comment, ...review }) => review),
    activities: section.activities.map((activity) => ({
      ...activity,
      activityName: activity.titleOverride?.trim() || activity.activityName,
    })),
    groupId,
    groupName: group.name,
  });
}

export function buildAssembledReportFromPrismaRow(
  row: SnapshotReportRow,
): AssembledReport {
  // Same comparator the live preview applies (PublicationService.compareSections):
  // sorting the mapped sections here makes the frozen order identical to what
  // the head previewed regardless of the database collation behind orderBy.
  const sections = row.sections
    .map(freezeSectionOwnership)
    .sort((left, right) =>
      left.authorName.localeCompare(right.authorName, "ru"),
    );
  // The mapper floors each product's traffic light by the author's covering
  // risks. Deriving totals from those mapped sections keeps product cards and
  // top-line totals consistent within the snapshot.
  const portfolioOverview = computePortfolioOverviewFromReadSections(sections);

  return assembledReportSchema.parse({
    reportId: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    deadline: row.deadline,
    status: row.status,
    publishedAt: row.publishedAt,
    publishedById: row.publishedById,
    publishedByName: row.publishedBy?.name ?? null,
    portfolioOverview,
    sections,
  });
}

/** Omission buckets of every section of one report, keyed by section id. */
export type SectionRecordOmissions = ReadonlyMap<string, RecordOmission>;

/**
 * Counts what each section's complete projection leaves out. Call it with the
 * same row passed to `buildAssembledReportFromPrismaRow`, so the frozen
 * content and its omission counts describe one database read.
 */
export function toSectionRecordOmissions(
  row: SnapshotReportRow,
): SectionRecordOmissions {
  return new Map(
    row.sections.map((section) => [section.id, toRecordOmission(section)]),
  );
}

/**
 * Serializes the immutable publication payload. A freeze passes the omission
 * buckets of its raw graph; without them the snapshot reads as "omissions
 * unknown", never as "nothing omitted". The assembled report itself stays
 * free of buckets because it is also a client-facing read model.
 */
export function toPublishedSnapshotJson(
  report: AssembledReport,
  omissions?: SectionRecordOmissions,
): Prisma.InputJsonValue {
  const sections =
    omissions === undefined
      ? report.sections
      : report.sections.map((section) => {
          const recordOmission = omissions.get(section.reportSectionId);
          if (recordOmission === undefined) {
            throw publishedSnapshotFailure(
              report.reportId,
              `section ${section.reportSectionId} has no omission count.`,
            );
          }
          return { ...section, recordOmission };
        });
  const parsed = publishedReportSnapshotSchema.parse({ ...report, sections });
  return JSON.parse(JSON.stringify(parsed)) as Prisma.InputJsonValue;
}

export function computePortfolioOverviewFromReadSections(
  sections: readonly ReportSectionReadModel[],
): PortfolioOverview {
  const totals = buildPortfolioProductsFromSnapshotSections(sections)
    .map(({ worstStatus }) => worstStatus)
    .filter((status): status is TrafficLightStatus => status !== null)
    .reduce<PortfolioOverview["totals"]>(
      (current, status) => ({
        ...current,
        [status]: current[status] + 1,
      }),
      { green: 0, yellow: 0, red: 0 },
    );

  const status: PortfolioOverview["status"] =
    totals.red > 0 ? "red" : totals.yellow > 0 ? "yellow" : "green";

  return { status, totals };
}
