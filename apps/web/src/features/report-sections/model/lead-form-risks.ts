import type { ReportSectionReadModel } from "@customreport/shared";

import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";
import type { RiskEntry } from "./types";

export type LeadRiskEntry = RiskEntry;

type SectionRisk = ReportSectionReadModel["risks"][number];

function requireRiskId(risk: SectionRisk): string {
  const id: unknown = risk.id ?? risk.stableId;
  if (typeof id === "string" && id.length > 0) return id;
  throw new Error(
    `Risk is missing both id and stableId (project ${risk.projectId ?? "none"}) — cannot map corrupt legacy lineage`,
  );
}

function mapRisk(
  risk: SectionRisk,
  projectIndex: ReturnType<typeof buildProjectIndex>,
  activityNameById: ReturnType<typeof buildActivityIndex>,
): LeadRiskEntry {
  const activityName = risk.activityId
    ? (activityNameById.get(risk.activityId) ?? "Unknown")
    : undefined;
  const productName = risk.projectId
    ? projectIndex.get(risk.projectId)?.name
    : undefined;
  return {
    id: requireRiskId(risk),
    productId: risk.projectId ?? "",
    productName: productName ?? activityName ?? "Unknown",
    ...(risk.activityId ? { activityId: risk.activityId, activityName } : {}),
    stageNames: risk.stageNames,
    severity: risk.severity,
    text: risk.risk,
    impact: risk.impact,
    mitigation: risk.mitigation,
  };
}

// `text` is only the risk field — impact/mitigation stay on the row but are not
// shown. Handlers keep non-empty defaults for safeText({min:1}) on those fields.
export function mapLeadRisks(section: ReportSectionReadModel): LeadRiskEntry[] {
  const projectIndex = buildProjectIndex(section);
  const activityNameById = buildActivityIndex(section);
  // Activity-parented risks render in the Risks section labeled with the
  // activity name, beside product risks.
  return section.risks
    .filter((r) => r.projectId != null || r.activityId != null)
    .map((risk) => mapRisk(risk, projectIndex, activityNameById));
}
