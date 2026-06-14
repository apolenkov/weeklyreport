import type { StageStatus } from "./mappers/traffic-light";

const PRECEDENCE: Record<StageStatus, number> = {
  blocked: 3,
  "at-risk": 2,
  "on-track": 1,
  empty: 0,
};

/**
 * Derives effective StageStatus from the risks/items that back the stage —
 * the single source of truth.
 *
 * rethink-pipeline-state-vs-completeness (supersedes the PRJ-2 "explicit chip
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
 * The `items` branch is preserved for the function's general contract but is
 * dead on the lead-pipeline path: both callers (`buildStageGrid`,
 * `applyRiskSeverityFloor`) pass `[]` — risks are the only live source there.
 */
export function deriveEffectiveStageStatus(
  explicit: StageStatus,
  risks: readonly { severity?: string }[],
  items: readonly { workflowStatus: string }[],
): StageStatus {
  let best: StageStatus = "empty";
  for (const r of risks) {
    const s: StageStatus = r.severity === "blocked" ? "blocked" : "at-risk";
    if (PRECEDENCE[s] > PRECEDENCE[best]) best = s;
  }
  for (const i of items) {
    if (
      i.workflowStatus === "blocked" &&
      PRECEDENCE.blocked > PRECEDENCE[best]
    ) {
      best = "blocked";
    }
  }
  if (best !== "empty") return best;
  // No backing risk/item: a manual at-risk/blocked has nothing to back it, so
  // it collapses to on-track; on-track/empty stay as-is.
  return explicit === "empty" ? "empty" : "on-track";
}
