import type { TrafficLightStatus } from "@customreport/shared";
import {
  type AssembledReport,
  assembledReportSchema,
  type PortfolioOverview,
  type PortfolioProductOverview,
  type ReportSectionReadModel,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { aggregateTrafficLight } from "./report-sections/domain/traffic-light-aggregation";
import { reportSectionFullInclude } from "./report-sections/infrastructure/report-sections.include";
import { mapPrismaToReportSection } from "./report-sections/infrastructure/report-sections.mappers";
import { deriveEffectiveProductStatus } from "./report-sections/infrastructure/report-sections.status-derivation";

export const reportFullIncludeForSnapshot = {
  sections: {
    include: reportSectionFullInclude,
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

export function buildAssembledReportFromPrismaRow(
  row: SnapshotReportRow,
): AssembledReport {
  const sections = row.sections.map(mapPrismaToReportSection);
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
  const parsed = assembledReportSchema.parse(report);
  return JSON.parse(JSON.stringify(parsed)) as Prisma.InputJsonValue;
}

export function parsePublishedSnapshot(
  value: Prisma.JsonValue | null | undefined,
): AssembledReport | null {
  if (value == null) return null;
  return assembledReportSchema.parse(value);
}

export function filterSnapshotSections(
  snapshot: AssembledReport,
  allowedSectionIds: ReadonlySet<string> | undefined,
): AssembledReport {
  if (!allowedSectionIds) return snapshot;

  const sections = snapshot.sections.filter((section) =>
    allowedSectionIds.has(section.reportSectionId),
  );

  return assembledReportSchema.parse({
    ...snapshot,
    portfolioOverview: computePortfolioOverviewFromReadSections(sections),
    sections,
  });
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

function computePublishedStageCount(
  occurrences: readonly ProjectOccurrence[],
): number {
  return Math.max(
    0,
    ...occurrences.map(({ project }) => project.stageSet.length),
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

export function buildPortfolioProductsFromSnapshotSections(
  sections: readonly ReportSectionReadModel[],
): PortfolioProductOverview[] {
  return [...groupProjectOccurrences(sections).values()]
    .flatMap((occurrences) => {
      const representative = occurrences[0];
      if (!representative) return [];

      const contributions = occurrences.map(({ project, section }) => ({
        leadId: section.authorId,
        leadName: section.authorName,
        status: effectiveProjectStatus(section, project),
      }));
      const statuses = contributions.flatMap(({ status }) =>
        status === null ? [] : [status],
      );
      const leadIds = contributions.flatMap(({ leadId, status }) =>
        status === null ? [] : [leadId],
      );
      const leadNames = contributions.flatMap(({ leadName, status }) =>
        status === null ? [] : [leadName],
      );

      return [
        {
          productId: representative.project.projectId,
          productName: representative.project.projectName,
          worstStatus: computeWorstStatus(statuses),
          stageCount: computePublishedStageCount(occurrences),
          leadIds: [...new Set(leadIds)],
          leadNames: [...new Set(leadNames)].sort((a, b) =>
            a.localeCompare(b, "ru"),
          ),
        },
      ];
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "ru"));
}

export const computeWorstStatus: (
  statuses: readonly TrafficLightStatus[],
) => TrafficLightStatus | null = aggregateTrafficLight;
