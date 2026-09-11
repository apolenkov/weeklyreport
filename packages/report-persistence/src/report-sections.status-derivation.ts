import {
  aggregateTrafficLight,
  canonicalToTrafficLight,
  type RiskSeverity,
  riskSeverityToCanonicalFloor,
  type TrafficLightStatus,
} from "@customreport/shared";

export { deriveEffectiveProductStatus } from "@customreport/shared";

type TrafficLight = TrafficLightStatus;

export function aggregateStageTraffic(
  stages: readonly { status?: string | null | undefined }[],
): TrafficLight | null {
  return aggregateTrafficLight(stages.map((stage) => asTraffic(stage.status)));
}

export function asTraffic(
  status: string | null | undefined,
): TrafficLight | null {
  return status === "green" || status === "yellow" || status === "red"
    ? status
    : null;
}

// An activity has no SDLC stage, so its pill is floored by its own risks only.
// `alarmFloor` is that record-only floor — the lead picker gates a manual lower
// on it alone, so a lead can still undo a raise they made themselves.
export function deriveActivityStatus(
  stored: TrafficLight | null,
  ownRisks: readonly { severity: RiskSeverity }[],
): { derivedStatus: TrafficLight | null; alarmFloor: TrafficLight | null } {
  const alarmFloor = aggregateTrafficLight(
    ownRisks.map((risk) =>
      canonicalToTrafficLight(riskSeverityToCanonicalFloor(risk.severity)),
    ),
  );
  return {
    derivedStatus: aggregateTrafficLight([stored, alarmFloor]),
    alarmFloor,
  };
}
