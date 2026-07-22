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
    // Postgres's default collation orders author names ascending here, but it
    // only approximates the live preview's Node/ICU localeCompare(..., "ru")
    // order. Exact parity is not guaranteed; this accepted residual gap keeps
    // the durable snapshot's ordering in one query-level location.
    // The id tiebreak keeps the order stable across reads when two authors
    // share a display name.
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
  const sections = row.sections.map((section) =>
    mapPrismaToReportSection(section),
  );
  // fix-published-empty-stage-risk-floor (D3 / blind-spot #7): compute the
  // top-line portfolio totals from the floored `trafficLight` of the mapped
  // sections, NOT from raw `projectStatuses`. The mapper already floors each
  // product card by the author's own covering risks; counting the same source
  // keeps the per-product cards and the top-line totals in agreement inside the
  // same snapshot.
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

/**
 * fix-published-empty-stage-risk-floor: the read-model snapshot readers receive
 * `ReportSectionReadModel`s directly (the persisted read model, or a
 * schema-built fixture) and must NOT trust the stored `project.trafficLight` —
 * it can be a stale green that predates the author's own covering risk. Fold
 * the section author's own risks (scoped to the product) over the owned stages
 * the same way the mapper does, so the snapshot readers agree with the PDF and
 * slide surfaces. Idempotent: re-flooring an already-floored trafficLight is a
 * no-op.
 */
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
  section: ReportSectionReadModel;
  project: ReportSectionReadModel["projects"][number];
}

/** Group every section-level occurrence by its stable product identity. */
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

/** Prefer the frozen cross-lead union while retaining legacy snapshot support. */
function computePublishedStageCount(
  occurrences: readonly ProjectOccurrence[],
): number {
  const stageSetCounts = occurrences.flatMap(({ project }) =>
    project.stageSet === undefined ? [] : [project.stageSet.length],
  );

  return stageSetCounts.length > 0
    ? Math.max(...stageSetCounts)
    : Math.max(
        0,
        ...occurrences.map(({ project }) => project.ownedStages?.length ?? 0),
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
        leadName: section.authorName,
        status: effectiveProjectStatus(section, project),
      }));
      const statuses = contributions.flatMap(({ status }) =>
        status === null ? [] : [status],
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
          leadNames: [...new Set(leadNames)].sort((a, b) =>
            a.localeCompare(b, "ru"),
          ),
        },
      ];
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "ru"));
}

export function computeWorstStatus(
  statuses: readonly TrafficLightStatus[],
): TrafficLightStatus | null {
  return aggregateTrafficLight(statuses);
}
