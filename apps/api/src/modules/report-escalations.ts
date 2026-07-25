import type { Escalation, ReportSectionReadModel } from "@customreport/shared";

import { effectiveProjectStatus } from "./published-report-snapshot.js";

// Single builder for live and published-snapshot paths (identical roll-up).

const UNKNOWN_PRODUCT_NAME = "Unknown";
const STAGE_NAME_SEPARATOR = ", ";

// stageIds holds stage NAMES, not UUIDs (TODO(STAGE-NAMING-01) in report-primitives).
function resolveStageName(
  stageIds: readonly string[] | undefined,
): string | null {
  if (!stageIds || stageIds.length === 0) return null;
  return stageIds.join(STAGE_NAME_SEPARATOR);
}

interface FlaggedRedRollUp {
  readonly escalations: readonly Escalation[];
  // Dedup co-owned red products to one at_risk per projectId (first lead wins);
  // carried across sections, so it grows rather than being rebuilt per section.
  readonly seenProjectIds: ReadonlySet<string>;
}

// Effective status (not stale trafficLight); one at_risk per projectId.
function flaggedRedRollUp(
  section: ReportSectionReadModel,
  seenProjectIds: ReadonlySet<string>,
): FlaggedRedRollUp {
  return section.projects.reduce<FlaggedRedRollUp>(
    (acc, project) => {
      if (effectiveProjectStatus(section, project) !== "red") return acc;
      if (acc.seenProjectIds.has(project.projectId)) return acc;
      return {
        escalations: [
          ...acc.escalations,
          {
            type: "at_risk",
            productName: project.projectName,
            stageName: null,
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

// Blocked escalation from blocked-severity risks only; skip null projectId activities.
function blockedRiskEscalations(
  section: ReportSectionReadModel,
  productNames: ReadonlyMap<string, string>,
): Escalation[] {
  return section.risks.flatMap((risk) => {
    if (risk.severity !== "blocked" || !risk.projectId) return [];
    return [
      {
        type: "blocked" as const,
        productName: productNames.get(risk.projectId) ?? UNKNOWN_PRODUCT_NAME,
        stageName: resolveStageName(risk.stageIds),
        leadName: section.authorName,
        description: risk.risk,
      },
    ];
  });
}

// A blocked-severity risk already escalates as `blocked` (above), so this emits
// `unresolved_risk` only for the remaining (at-risk) severities — a single risk
// never produces both escalation types.
function unresolvedRiskEscalations(
  section: ReportSectionReadModel,
  productNames: ReadonlyMap<string, string>,
): Escalation[] {
  return section.risks.flatMap((risk) => {
    if (risk.severity === "blocked" || !risk.projectId) return [];
    return [
      {
        type: "unresolved_risk" as const,
        productName: productNames.get(risk.projectId) ?? UNKNOWN_PRODUCT_NAME,
        stageName: resolveStageName(risk.stageIds),
        leadName: section.authorName,
        description: risk.risk,
      },
    ];
  });
}

function productNamesFor(
  section: ReportSectionReadModel,
): ReadonlyMap<string, string> {
  return new Map(
    [...section.projects, ...(section.referencedProjects ?? [])].map(
      (project) => [project.projectId, project.projectName] as const,
    ),
  );
}

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
          ...blockedRiskEscalations(section, productNames),
          ...flaggedRed.escalations,
          ...unresolvedRiskEscalations(section, productNames),
        ],
        seenProjectIds: flaggedRed.seenProjectIds,
      };
    },
    { escalations: [], seenProjectIds: new Set<string>() },
  );
  return [...rolledUp.escalations];
}
