// Mirror the server alarm floor from live draft risks: blocked => red,
// at-risk => yellow, and blank placeholder risks cover nothing.

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
  if (covering.some((risk) => risk.severity === "blocked")) return "red";
  if (covering.length > 0) return "yellow";
  return null;
}
