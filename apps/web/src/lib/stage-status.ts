import {
  type CanonicalStatus,
  type RiskSeverity,
  riskSeverityToCanonicalFloor,
  worstCanonicalStatus,
} from "@customreport/shared";

/**
 * Derives effective StageStatus from the risks/items that back the stage —
 * the single source of truth.
 *
 * Severity is the max over covering risks (and blocked items); an explicit
 * at-risk/blocked with NO backing risk cannot survive, because under the
 * one-source model status is derived from risks and cannot drift from them.
 * Such an orphaned manual severity collapses to on-track (the stage was
 * touched, so it is not "empty"). on-track / empty pass through untouched —
 * they are the completeness signal, not a severity.
 *
 * Why on-track, not empty: it matches `handleRisksChange` in the sync bridge,
 * which resets a stage to on-track when its last covering risk is removed —
 * so a freshly-reloaded read model agrees with the live form.
 *
 * Severity precedence: blocked > at-risk > on-track > empty — the worst
 * covering severity wins; with no backing risk/item an orphaned
 * at-risk/blocked `explicit` collapses to on-track, while on-track/empty
 * pass through (callers wanting an untouched empty stage skip the call).
 */
export function deriveEffectiveStageStatus(
  explicit: CanonicalStatus,
  risks: readonly { severity: RiskSeverity }[],
  items: readonly { workflowStatus: string }[],
): CanonicalStatus {
  const riskBest = worstCanonicalStatus(
    risks.map((r) => riskSeverityToCanonicalFloor(r.severity)),
  );
  const best = items.some((i) => i.workflowStatus === "blocked")
    ? worstCanonicalStatus([riskBest, "blocked"])
    : riskBest;
  if (best !== "empty") return best;
  // No backing risk/item: a manual at-risk/blocked has nothing to back it, so
  // it collapses to on-track; on-track/empty stay as-is.
  return explicit === "empty" ? "empty" : "on-track";
}
