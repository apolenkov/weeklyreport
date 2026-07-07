import type { Escalation, ReportSectionReadModel } from "@customreport/shared";

import { effectiveProjectStatus } from "./published-report-snapshot.js";

/**
 * The single escalations builder for BOTH the live and published-snapshot
 * paths. Both feed `ReportSectionReadModel[]`, so one function guarantees
 * byte-identical roll-up output across the two surfaces.
 */

const UNKNOWN_PRODUCT_NAME = "Unknown";
const STAGE_NAME_SEPARATOR = ", ";

/**
 * Joins all stage names carried by a row into a multi-stage display label,
 * or null for legacy stage-less rows. `stageIds` is a misnomer — it holds
 * stage NAMES, not UUIDs (see TODO(STAGE-NAMING-01) in report-primitives).
 */
function resolveStageName(
  stageIds: readonly string[] | undefined,
): string | null {
  if (!stageIds || stageIds.length === 0) return null;
  return stageIds.join(STAGE_NAME_SEPARATOR);
}

/**
 * fix-published-empty-stage-risk-floor: fire the "flagged red" escalation off
 * the risk-aware effective status, not the stale stored trafficLight, so the
 * bug case (owned empty stage covered by a blocked own risk) emits the at_risk
 * escalation alongside the existing unresolved_risk one.
 *
 * fix-flagged-red-escalation-dedup: a co-owned red product appears once per
 * co-owner section, so the push is gated on `seen` to emit one escalation per
 * `projectId` across the whole builder run. Returns null when the product is
 * not red or was already emitted; mutates `seen` on first emission.
 */
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

// record-status-derived-from-risk: a blocker is a blocked-severity RISK, not a
// free-blocked item, so the `blocked` escalation is sourced from blocked-severity
// risks — REPLACING the former `item.workflowStatus === "blocked"` source. A
// blocked-severity risk yields ONE `blocked` escalation (never also an
// `unresolved_risk`, see below), so the roll-up count never inflates.
// activity-first-class: the null-projectId (activity-parented) skip stays so
// an activity's blockers never reach the product-level roll-up.
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
  // fix-flagged-red-escalation-dedup: a co-owned red product appears once in
  // EACH co-owner's section, so without this the project-level flagged-red
  // push fires N identical rows. Track seen projectIds across the WHOLE section
  // loop and emit the flagged-red escalation once per product; the first
  // contributing lead's name survives (deterministic by loop order). Only the
  // `at_risk` flagged-red push is gated — `blocked` items and `unresolved_risk`
  // risks are genuinely per-record and stay un-deduped.
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
