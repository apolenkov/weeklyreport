import { deriveEffectiveProductStatus } from "../../status/effective-product-status.js";
import { aggregateTrafficLight } from "../../status/traffic-light-aggregation.js";
import type { ReportSectionReadModel } from "../report-sections/section.schema.js";
import type { PortfolioProductOverview } from "./report.schema.js";

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
  return occurrences.reduce(
    (max, { project }) => Math.max(max, project.stageSet.length),
    0,
  );
}

function effectiveProjectStatus({
  project,
  section,
}: ProjectOccurrence): ReturnType<typeof deriveEffectiveProductStatus> {
  return deriveEffectiveProductStatus({
    projectId: project.projectId,
    trafficLight: project.trafficLight,
    ownedStages: project.ownedStages,
    risks: section.risks,
  });
}

/** Builds the canonical product projection from the supplied section scope. */
export function buildPortfolioProductsFromSnapshotSections(
  sections: readonly ReportSectionReadModel[],
): PortfolioProductOverview[] {
  const ownedProducts = [...groupProjectOccurrences(sections).values()].flatMap(
    (occurrences) => {
      const representative = occurrences[0];
      if (!representative) return [];

      const contributions = occurrences.map((occurrence) => ({
        leadId: occurrence.section.authorId,
        leadName: occurrence.section.authorName,
        status: effectiveProjectStatus(occurrence),
      }));
      const valuedContributions = contributions.filter(
        ({ status }) => status !== null,
      );
      const statuses = valuedContributions.map(({ status }) => status);
      const leadIds = valuedContributions.map(({ leadId }) => leadId);
      const leadNames = valuedContributions.map(({ leadName }) => leadName);

      return [
        {
          productId: representative.project.projectId,
          productName: representative.project.projectName,
          worstStatus: aggregateTrafficLight(statuses),
          stageCount: computePublishedStageCount(occurrences),
          leadIds: [...new Set(leadIds)],
          leadNames: [...new Set(leadNames)].sort((a, b) =>
            a.localeCompare(b, "ru"),
          ),
        },
      ];
    },
  );
  const ownedProductIds = new Set(
    ownedProducts.map(({ productId }) => productId),
  );
  // Frozen references grant display membership only; owned occurrences above
  // remain the sole source of health, stage, and lead attribution.
  // One pass groups the references in first-seen order; the first occurrence
  // names the product.
  const referencedOnlyProducts = [
    ...Map.groupBy(
      sections.flatMap(({ referencedProjects }) => referencedProjects),
      ({ projectId }) => projectId,
    ),
  ].flatMap(([productId, [reference]]): PortfolioProductOverview[] =>
    reference === undefined || ownedProductIds.has(productId)
      ? []
      : [
          {
            productId,
            productName: reference.projectName,
            worstStatus: null,
            stageCount: 0,
            leadIds: [],
            leadNames: [],
          },
        ],
  );

  return [...ownedProducts, ...referencedOnlyProducts].sort((a, b) =>
    a.productName.localeCompare(b.productName, "ru"),
  );
}
