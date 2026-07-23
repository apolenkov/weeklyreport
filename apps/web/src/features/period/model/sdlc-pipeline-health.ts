import { worstCanonicalStatus } from "@customreport/shared";
import type { CSSProperties } from "react";

import type {
  Product,
  StageAssignment,
  StageStatus,
} from "../../report-sections";
import { STATUS_CONFIG, trafficToStageStatus } from "../../report-sections";
import type { CrossAuthorEntry } from "../ui/sdlc-pipeline";

// Every product card shares ONE body — neutral card surface, neutral ring —
// and only the 4px left-stripe color changes with the HEALTH status. The
// left edge is ALWAYS solid and only carries health (severity); the
// completeness signal lives on the right (dashed ring + N/M counter) and
// never shares this hue. paddingLeft compensates the 3px-wider left border
// so content padding reads equal.
const STRIPE_BY_STATUS: Record<StageStatus, string> = {
  blocked: "var(--color-chip-blocked-border)",
  "at-risk": "var(--color-status-at-risk-border)",
  "on-track": "var(--color-chip-on-track-border)",
  empty: "var(--color-border)",
};

// Health severity order comes from the shared canonical ladder
// (blocked > at-risk > on-track > empty; empty = nothing set yet).
const worstStatusOf = worstCanonicalStatus;

// The collapsed `+N more` indicator colours by the FULL status scale of the
// hidden stages, by precedence — red if any blocked, else yellow if any
// at-risk, else grey if any is unfilled (empty), else green when every
// hidden stage is on-track. This lets the lead trace the product's left
// health stripe to the collapsed stages at a glance.
export function collapsedIndicatorColors(statuses: readonly StageStatus[]): {
  border: string;
  text: string;
} {
  const set = new Set(statuses);
  const status: StageStatus = set.has("blocked")
    ? "blocked"
    : set.has("at-risk")
      ? "at-risk"
      : set.has("empty")
        ? "empty"
        : "on-track";
  return {
    border: STATUS_CONFIG[status].border,
    text: STATUS_CONFIG[status].text,
  };
}

function worstOwnStatus(stages: StageAssignment[]): StageStatus {
  return worstStatusOf(
    stages.filter((s) => s.ownership === "mine").map((s) => s.status),
  );
}

/**
 * A stage status raised by ANY stage owner — including another lead on a
 * shared product — must light the left edge. Foreign status arrives
 * RISK-DERIVED via `crossAuthors[].stages` (the server folds covering risks
 * into the per-stage traffic light), so the health hue is max(own worst
 * stage, worst foreign stage). An `empty`/`null` foreign stage contributes
 * nothing.
 */
function worstForeignSeverity(
  productId: string,
  crossAuthors: readonly CrossAuthorEntry[],
): StageStatus {
  const severities = crossAuthors
    .filter((ca) => ca.projectId === productId)
    .flatMap((ca) => ca.stages)
    .map<StageStatus>((s) => trafficToStageStatus(s.status));
  return worstStatusOf(severities);
}

export function productHealthStatus(
  product: Product,
  crossAuthors: readonly CrossAuthorEntry[],
): StageStatus {
  return worstStatusOf([
    worstOwnStatus(product.stages),
    worstForeignSeverity(product.id, crossAuthors),
  ]);
}

/**
 * Own-input completeness, over the lead's OWN stages only. A stage counts as
 * filled when EITHER the lead set an explicit status on it
 * (status !== "empty") OR the lead deliberately staged their OWN risk on it
 * (the RAW `coveredByOwnRisk` flag — a stage they addressed via the risk
 * surface). It MUST still be fed the RAW product (the mapper/bridge derive
 * `coveredByOwnRisk` strictly from persisted own risks that EXPLICITLY name
 * the stage), NEVER the risk-derived render-time severity floor: the floor
 * colors empty AND foreign-covered stages, so counting it would inflate the
 * counter for stages the lead never touched. Foreign severity never touches
 * this counter.
 */
export interface CompletenessState {
  filled: number;
  total: number;
  complete: boolean;
}

export function computeCompleteness(product: Product): CompletenessState {
  const mine = product.stages.filter((s) => s.ownership === "mine");
  const filled = mine.filter(
    (s) => s.status !== "empty" || s.coveredByOwnRisk === true,
  ).length;
  return {
    filled,
    total: mine.length,
    complete: mine.length > 0 && filled === mine.length,
  };
}

export function getProductCardStyle(status: StageStatus): CSSProperties {
  return {
    background: "var(--color-card)",
    border: "1px solid var(--color-border-subtle)",
    borderLeft: `4px solid ${STRIPE_BY_STATUS[status]}`,
    paddingLeft: "calc(1rem - 3px)",
  };
}
