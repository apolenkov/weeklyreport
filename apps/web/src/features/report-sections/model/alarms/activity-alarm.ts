// Mirror the server alarm floor from live draft risks: blocked => red,
// at-risk => yellow, and blank placeholder risks cover nothing.

import {
  canonicalToTrafficLight,
  riskSeverityToCanonicalFloor,
  worstCanonicalStatus,
} from "@customreport/shared";

export type ActivityAlarmFloor = "yellow" | "red" | null;

interface ActivityAlarmRisk {
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
    (risk) => risk.activityId === activityId && risk.text.trim().length > 0,
  );
  if (covering.length === 0) return null;
  const floor = canonicalToTrafficLight(
    worstCanonicalStatus(
      covering.map((risk) => riskSeverityToCanonicalFloor(risk.severity)),
    ),
  );
  return floor === "red" || floor === "yellow" ? floor : null;
}
