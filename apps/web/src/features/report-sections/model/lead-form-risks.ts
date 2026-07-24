import type { ReportSectionReadModel } from "@customreport/shared";

import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";
import type { RiskEntry } from "./types";

export type LeadRiskEntry = RiskEntry;

/**
 * Map a section's risks into RiskEntry presentation rows. The UI surfaces a
 * single textarea for the user-controlled `risk` field; impact/mitigation are
 * stored on the raw row but not shown (handler keeps non-empty defaults so
 * the schema's safeText({min:1}) refinement on those fields stays satisfied).
 *
 * Earlier the mapper concatenated `${risk} — Impact: ${impact} — Mitigation: ${mitigation}`
 * into `text`, but `handleRisksChange` writes `risk: r.text` straight back, so
 * every render double-concatenated the existing fields and corrupted the row.
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
