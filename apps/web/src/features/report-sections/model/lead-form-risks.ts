import type { ReportSectionReadModel } from "@customreport/shared";

import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";
import type { RiskEntry } from "./types";

export type LeadRiskEntry = RiskEntry;

// `text` is only the risk field — impact/mitigation stay on the row but are not
// shown. Handlers keep non-empty defaults for safeText({min:1}) on those fields.
/**
 * Map Lead Risks.
 * @param section - The section argument.
 */
export function mapLeadRisks(section: ReportSectionReadModel): LeadRiskEntry[] {
  const projectIndex = buildProjectIndex(section);
  const activityNameById = buildActivityIndex(section);
  // Activity-parented risks render in the Risks section labeled with the
  // activity name, beside product risks.
  return section.risks
    .filter((r) => r.projectId != null || r.activityId != null)
    .map((r, idx) => {
      const activityName =
        r.activityId != null
          ? (activityNameById.get(r.activityId) ?? "Unknown")
          : undefined;
      const project =
        r.projectId != null ? projectIndex.get(r.projectId) : undefined;
      return {
        id: r.id ?? `risk-${idx}`,
        productId: r.projectId ?? "",
        productName: project?.name ?? activityName ?? "Unknown",
        ...(r.activityId != null
          ? { activityId: r.activityId, activityName }
          : {}),
        // Stage array from DB; legacy rows fall back to undefined.
        stageIds: r.stageIds,
        severity: r.severity,
        text: r.risk,
        impact: r.impact,
        mitigation: r.mitigation,
      };
    });
}
