/**
 * Client-side twin of the server's `deriveActivityStatus` alarm floor
 * (report-sections.prisma-repository.ts): an activity is floored by its OWN
 * risks only — a blocked risk forces red, an at-risk risk at least yellow;
 * items never floor (they carry progress, not alarms). Derived from the LIVE
 * draft risks so a just-created activity risk floors the pill without a
 * save/refetch round-trip — the activity analogue of `applyRiskSeverityFloor`
 * for stage chips. An empty (placeholder) risk covers nothing, matching the
 * stage-floor rule.
 */

export type ActivityAlarmFloor = "yellow" | "red" | null;

/** Minimal risk shape the derivation reads. */
interface ActivityAlarmRisk {
  readonly activityId?: string | null;
  readonly severity: "at-risk" | "blocked";
  /** The risk's own text — an empty (placeholder) risk covers nothing. */
  readonly text: string;
}

/**
 * Derive Activity Alarm Floor.
 * @param activityId - The activityId argument.
 * @param risks - The risks argument.
 */
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
