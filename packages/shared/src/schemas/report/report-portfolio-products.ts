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
  return Math.max(
    0,
    ...occurrences.map(({ project }) => project.stageSet.length),
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
  const referencedProducts = sections
    .flatMap(({ referencedProjects }) => referencedProjects)
    .reduce<ReadonlyMap<string, string>>((current, reference) => {
      if (
        ownedProductIds.has(reference.projectId) ||
        current.has(reference.projectId)
      ) {
        return current;
      }
      return new Map(current).set(reference.projectId, reference.projectName);
    }, new Map<string, string>());

  const referencedOnlyProducts: PortfolioProductOverview[] = [
    ...referencedProducts,
  ].map(([productId, productName]) => ({
    productId,
    productName,
    worstStatus: null,
    stageCount: 0,
    leadIds: [],
    leadNames: [],
  }));

  return [...ownedProducts, ...referencedOnlyProducts].sort((a, b) =>
    a.productName.localeCompare(b.productName, "ru"),
  );
}
