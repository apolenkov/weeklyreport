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
 * rethink-pipeline-state-vs-completeness (supersedes the earlier "explicit chip
 * status must win" rule): severity is the max over covering risks (and blocked
 * items); an explicit at-risk/blocked with NO backing risk can no longer
 * survive, because under the one-source model status is derived from risks and
 * cannot drift from them. Such an orphaned manual severity collapses to
 * on-track (the stage was touched, so it is not "empty"). on-track / empty
 * pass through untouched — they are the completeness signal, not a severity.
 *
 * Why on-track, not empty: it matches `handleRisksChange` in the sync bridge,
 * which resets a stage to on-track when its last covering risk is removed —
 * so a freshly-reloaded read model agrees with the live form.
 *
 * Severity precedence: blocked > at-risk > on-track > empty.
 *
 * Four callers:
 * - `applyRiskSeverityFloor` (lead live form) and `floorSlideStageStatus`
 *   (slide/preview) pass `items: []` — risks are the only live source there.
 * - `buildStageGrid` (lead-form.ts, the read model) passes a real `explicit`
 *   traffic status plus real `risks` (and `items: []`). It calls this only for
 *   a TOUCHED stage (explicit !== empty), to floor up / collapse down; an
 *   untouched empty stage skips the call and stays empty so own-input
 *   completeness is not inflated by a covering risk.
 * - `buildCrossAuthorStageMap` (lead-cross-author.ts, the read-only "Other
 *   contributors" chip) passes a real `explicit` traffic status plus real
 *   `risks`/`items`. The collapse-down above intentionally applies there too:
 *   a foreign author's persisted red/amber status with NO covering risk now
 *   collapses to on-track, consistent with the one-source model. Only stale
 *   traffic-only data (no backing risk) is affected.
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
