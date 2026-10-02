import { deriveEffectiveProductStatus } from "../../status/effective-product-status.js";
import type { ReportSectionReadModel } from "../report-sections/section.schema.js";
import type { Escalation } from "./report.schema.js";

const UNKNOWN_PRODUCT_NAME = "Unknown";
const STAGE_NAME_SEPARATOR = ", ";

function resolveStageName(stageNames: readonly string[]): string {
  if (stageNames.length === 0) {
    throw new Error("Escalation source must carry at least one stage name");
  }
  return stageNames.join(STAGE_NAME_SEPARATOR);
}

function productNamesFor(
  section: ReportSectionReadModel,
): ReadonlyMap<string, string> {
  return new Map(
    [...section.projects, ...section.referencedProjects].map(
      (project) => [project.projectId, project.projectName] as const,
    ),
  );
}

function riskEscalations(
  section: ReportSectionReadModel,
  productNames: ReadonlyMap<string, string>,
  type: "blocked" | "unresolved_risk",
  predicate: (
    severity: ReportSectionReadModel["risks"][number]["severity"],
  ) => boolean,
): Escalation[] {
  return section.risks.flatMap((risk) => {
    if (!predicate(risk.severity) || !risk.projectId) return [];
    return [
      {
        type,
        productId: risk.projectId,
        productName: productNames.get(risk.projectId) ?? UNKNOWN_PRODUCT_NAME,
        stageName: resolveStageName(risk.stageNames),
        authorId: section.authorId,
        leadName: section.authorName,
        description: risk.risk,
      },
    ];
  });
}

interface FlaggedRedRollUp {
  readonly escalations: readonly Escalation[];
  readonly seenProjectIds: ReadonlySet<string>;
}

function flaggedRedRollUp(
  section: ReportSectionReadModel,
  seenProjectIds: ReadonlySet<string>,
): FlaggedRedRollUp {
  return section.projects.reduce<FlaggedRedRollUp>(
    (acc, project) => {
      if (
        deriveEffectiveProductStatus({
          projectId: project.projectId,
          trafficLight: project.trafficLight,
          ownedStages: project.ownedStages,
          risks: section.risks,
        }) !== "red" ||
        acc.seenProjectIds.has(project.projectId)
      ) {
        return acc;
      }
      return {
        escalations: [
          ...acc.escalations,
          {
            type: "at_risk",
            productId: project.projectId,
            productName: project.projectName,
            stageName: null,
            authorId: section.authorId,
            leadName: section.authorName,
            description: `Project ${project.projectName} is flagged red.`,
          },
        ],
        seenProjectIds: new Set([...acc.seenProjectIds, project.projectId]),
      };
    },
    { escalations: [], seenProjectIds },
  );
}

/**
 * Builds the canonical escalation projection for report sections in input
 * order, including one effective-red signal per owned product ID.
 */
export function buildEscalationsFromReadSections(
  sections: readonly ReportSectionReadModel[],
): Escalation[] {
  const rolledUp = sections.reduce<FlaggedRedRollUp>(
    (acc, section) => {
      const productNames = productNamesFor(section);
      const flaggedRed = flaggedRedRollUp(section, acc.seenProjectIds);
      return {
        escalations: [
          ...acc.escalations,
          ...riskEscalations(
            section,
            productNames,
            "blocked",
            (severity) => severity === "blocked",
          ),
          ...flaggedRed.escalations,
          ...riskEscalations(
            section,
            productNames,
            "unresolved_risk",
            (severity) => severity !== "blocked",
          ),
        ],
        seenProjectIds: flaggedRed.seenProjectIds,
      };
    },
    { escalations: [], seenProjectIds: new Set<string>() },
  );
  return [...rolledUp.escalations];
}
