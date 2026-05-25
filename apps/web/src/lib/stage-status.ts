import type { StageStatus } from "./mappers/traffic-light";

const PRECEDENCE: Record<StageStatus, number> = {
  blocked: 3,
  "at-risk": 2,
  "on-track": 1,
  empty: 0,
};

/**
 * Derives effective StageStatus as max over three sources:
 * 1. Explicit StageStatus (from TrafficLight mapping)
 * 2. Risk.severity ("blocked"→blocked, else→at-risk)
 * 3. KanbanItem.workflowStatus ("blocked"→blocked)
 * Precedence: blocked > at-risk > on-track > empty
 */
export function deriveEffectiveStageStatus(
  explicit: StageStatus,
  risks: ReadonlyArray<{ severity?: string }>,
  items: ReadonlyArray<{ workflowStatus: string }>,
): StageStatus {
  let best = explicit;
  for (const r of risks) {
    const s: StageStatus = r.severity === "blocked" ? "blocked" : "at-risk";
    if (PRECEDENCE[s] > PRECEDENCE[best]) best = s;
  }
  for (const i of items) {
    if (i.workflowStatus === "blocked" && PRECEDENCE.blocked > PRECEDENCE[best]) {
      best = "blocked";
    }
  }
  return best;
}
