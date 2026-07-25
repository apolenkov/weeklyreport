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

// Effective status (not stale trafficLight); one at_risk per projectId via seen.
function flaggedRedEscalation(
  section: ReportSectionReadModel,
  project: ReportSectionReadModel["projects"][number],
  seen: Set<string>,
): Escalation | null {
  if (effectiveProjectStatus(section, project) !== "red") return null;
  if (seen.has(project.projectId)) return null;
  seen.add(project.projectId);
  return {
    type: "at_risk",
    productName: project.projectName,
    stageName: null,
    leadName: section.authorName,
    description: `Project ${project.projectName} is flagged red.`,
  };
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

export function buildEscalationsFromReadSections(
  sections: readonly ReportSectionReadModel[],
): Escalation[] {
  const escalations: Escalation[] = [];
  // Dedup co-owned red products to one at_risk per projectId (first lead wins).
  const seenFlaggedRedProjectIds = new Set<string>();

  for (const section of sections) {
    const productNames = new Map(
      [...section.projects, ...(section.referencedProjects ?? [])].map(
        (project) => [project.projectId, project.projectName] as const,
      ),
    );

    escalations.push(...blockedRiskEscalations(section, productNames));

    for (const project of section.projects) {
      const flaggedRed = flaggedRedEscalation(
        section,
        project,
        seenFlaggedRedProjectIds,
      );
      if (flaggedRed) escalations.push(flaggedRed);
    }

    escalations.push(...unresolvedRiskEscalations(section, productNames));
  }

  return escalations;
}
