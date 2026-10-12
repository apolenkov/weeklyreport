import {
  type CanonicalStatus,
  type RiskSeverity,
  riskSeverityToCanonicalFloor,
  worstCanonicalStatus,
} from "@weeklyreport/shared";

// Severity is max over covering risks; orphaned manual
// at-risk/blocked collapses to on-track so the read model matches handleRisksChange.
export function deriveEffectiveStageStatus(
  explicit: CanonicalStatus,
  risks: readonly { severity: RiskSeverity }[],
): CanonicalStatus {
  const worstRiskStatus = worstCanonicalStatus(
    risks.map((r) => riskSeverityToCanonicalFloor(r.severity)),
  );
  if (worstRiskStatus !== "empty") return worstRiskStatus;
  // No backing risk: a manual at-risk/blocked has nothing to back it, so
  // it collapses to on-track; on-track/empty stay as-is.
  return explicit === "empty" ? "empty" : "on-track";
}
