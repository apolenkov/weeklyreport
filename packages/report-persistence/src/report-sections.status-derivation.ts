import {
  aggregateTrafficLight,
  asTrafficLight as asTraffic,
  canonicalToTrafficLight,
  isCompleteRisk,
  type RiskSeverity,
  riskSeverityToCanonicalFloor,
  type TrafficLightStatus,
} from "@weeklyreport/shared";

export { deriveEffectiveProductStatus } from "@weeklyreport/shared";

type TrafficLight = TrafficLightStatus;

export function aggregateStageTraffic(
  stages: readonly { status?: string | null | undefined }[],
): TrafficLight | null {
  return aggregateTrafficLight(stages.map((stage) => asTraffic(stage.status)));
}

// Preserve the existing persistence export while shared owns normalization.
export { asTrafficLight as asTraffic } from "@weeklyreport/shared";

// An activity has no SDLC stage, so its pill is floored by its own risks only.
// `alarmFloor` is that record-only floor — the lead picker gates a manual lower
// on it alone, so a lead can still undo a raise they made themselves.
// Only a complete risk floors: a draft missing a detail changes no status.
export function deriveActivityStatus(
  stored: TrafficLight | null,
  ownRisks: readonly {
    severity: RiskSeverity;
    impact: string | null;
    mitigation: string | null;
  }[],
): { derivedStatus: TrafficLight | null; alarmFloor: TrafficLight | null } {
  const alarmFloor = aggregateTrafficLight(
    ownRisks
      .filter(isCompleteRisk)
      .map((risk) =>
        canonicalToTrafficLight(riskSeverityToCanonicalFloor(risk.severity)),
      ),
  );
  return {
    derivedStatus: aggregateTrafficLight([stored, alarmFloor]),
    alarmFloor,
  };
}
