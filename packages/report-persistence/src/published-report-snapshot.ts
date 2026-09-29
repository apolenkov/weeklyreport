import type { TrafficLightStatus } from "@customreport/shared";
import {
  type AssembledReport,
  assembledReportSchema,
  type PortfolioOverview,
  type PublishedReportSectionReadModel,
  publishedReportSectionReadModelSchema,
  publishedReportSnapshotSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";
import { aggregateTrafficLight } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { publishedSnapshotFailure } from "./published-snapshot.js";
import { reportSectionFullInclude } from "./report-sections.include.js";
import { mapPrismaToReportSection } from "./report-sections.mappers.js";
import { deriveEffectiveProductStatus } from "./report-sections.status-derivation.js";

export {
  parsePublishedSnapshot,
  requirePublishedSnapshot,
} from "./published-snapshot.js";

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
    // Postgres collation approximates Node/ICU localeCompare("ru"); id
    // tiebreak stabilizes shared display names. Exact parity not guaranteed.
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
  const sections = row.sections.map(freezeSectionOwnership);
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

export function toPublishedSnapshotJson(
  report: AssembledReport,
): Prisma.InputJsonValue {
  const parsed = publishedReportSnapshotSchema.parse(report);
  return JSON.parse(JSON.stringify(parsed)) as Prisma.InputJsonValue;
}

// Re-flooring keeps stale stored traffic lights aligned with product risks.
export function effectiveProjectStatus(
  section: ReportSectionReadModel,
  project: ReportSectionReadModel["projects"][number],
): TrafficLightStatus | null {
  return deriveEffectiveProductStatus({
    projectId: project.projectId,
    trafficLight: project.trafficLight,
    ownedStages: project.ownedStages,
    risks: section.risks,
  });
}

interface ProjectOccurrence {
  readonly section: ReportSectionReadModel;
  readonly project: ReportSectionReadModel["projects"][number];
}

function groupProjectOccurrences(
  sections: readonly ReportSectionReadModel[],
): Map<string, ProjectOccurrence[]> {
  return Map.groupBy(
    sections.flatMap((section) =>
      section.projects.map((project) => ({ project, section })),
    ),
    ({ project }) => project.projectId,
  );
}

export function computePortfolioOverviewFromReadSections(
  sections: readonly ReportSectionReadModel[],
): PortfolioOverview {
  const totals = [...groupProjectOccurrences(sections).values()]
    .map((occurrences) =>
      computeWorstStatus(
        occurrences.flatMap(({ project, section }) => {
          const status = effectiveProjectStatus(section, project);
          return status === null ? [] : [status];
        }),
      ),
    )
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

export { buildPortfolioProductsFromSnapshotSections } from "@customreport/shared";

export const computeWorstStatus: (
  statuses: readonly TrafficLightStatus[],
) => TrafficLightStatus | null = aggregateTrafficLight;
