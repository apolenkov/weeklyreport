import {
  type CanonicalStatus,
  type RiskSeverity,
  riskSeverityToCanonicalFloor,
  worstCanonicalStatus,
} from "@customreport/shared";

// Severity is max over covering risks/blocked items; orphaned manual
// at-risk/blocked collapses to on-track so the read model matches handleRisksChange.
export function deriveEffectiveStageStatus(
  explicit: CanonicalStatus,
  risks: readonly { severity: RiskSeverity }[],
  items: readonly { workflowStatus: string }[],
): CanonicalStatus {
  const worstRiskStatus = worstCanonicalStatus(
    risks.map((r) => riskSeverityToCanonicalFloor(r.severity)),
  );
  const worstBackedStatus = items.some((i) => i.workflowStatus === "blocked")
    ? worstCanonicalStatus([worstRiskStatus, "blocked"])
    : worstRiskStatus;
  if (worstBackedStatus !== "empty") return worstBackedStatus;
  // No backing risk/item: a manual at-risk/blocked has nothing to back it, so
  // it collapses to on-track; on-track/empty stay as-is.
  return explicit === "empty" ? "empty" : "on-track";
}
