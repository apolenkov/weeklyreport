// Mirror the server alarm floor from live draft risks: blocked => red,
// at-risk => yellow; blank placeholders and risks missing a detail cover
// nothing.

import {
  canonicalToTrafficLight,
  riskSeverityToCanonicalFloor,
  worstCanonicalStatus,
} from "@weeklyreport/shared";

import {
  hasCompleteRiskDetails,
  type RiskDetailText,
} from "./risk-completeness";

export type ActivityAlarmFloor = "yellow" | "red" | null;

interface ActivityAlarmRisk extends RiskDetailText {
  readonly activityId?: string | null | undefined;
  readonly severity: "at-risk" | "blocked";
  // Blank text marks a placeholder that covers no activity.
  readonly text: string;
}

export function deriveActivityAlarmFloor(
  activityId: string,
  risks: readonly ActivityAlarmRisk[],
): ActivityAlarmFloor {
  const covering = risks.filter(
    (risk) =>
      risk.activityId === activityId &&
      risk.text.trim().length > 0 &&
      hasCompleteRiskDetails(risk),
  );
  if (covering.length === 0) return null;
  const floor = canonicalToTrafficLight(
    worstCanonicalStatus(
      covering.map((risk) => riskSeverityToCanonicalFloor(risk.severity)),
    ),
  );
  return floor === "red" || floor === "yellow" ? floor : null;
}
