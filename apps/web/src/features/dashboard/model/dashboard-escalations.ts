import type { Escalation } from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

import type { BlockedAtRiskItem } from "./dashboard";

// Shown when a stage-keyed escalation (blocked item / unresolved risk) carries
// no stage — the legacy stage-less item/risk case (empty stageNames). The API
// builder returns stageName=null identically on the live and snapshot paths, so
// this label is the single place that empty case is worded.
const NO_STAGE_LABEL = "No stage set";

// The product-level "flagged red" escalation (type "at_risk") is a product
// traffic-light roll-up, not a stage-keyed blocker/risk, so it has no stage by
// design. It is gutter-labeled "Flagged" — matching the report accordion's
// EscalationRow — never the stage-less "No stage set", which would read as a
// data defect on a row that legitimately has no stage.
const FLAGGED_STAGE_LABEL = "Flagged";

/**
 * Escalation To Blocked Item.
 * @param escalation - The escalation argument.
 * @param index - The index argument.
 */
export function escalationToBlockedItem(
  escalation: Escalation,
  index: number,
): BlockedAtRiskItem | null {
  if (escalation.type === "blocked") {
    return {
      id: `esc-${index}`,
      severity: "blocked",
      product: escalation.productName,
      stage: escalation.stageName ?? NO_STAGE_LABEL,
      assignee: shortNameFromName(escalation.leadName),
      description: escalation.description,
    };
  }
  if (escalation.type === "at_risk") {
    return {
      id: `esc-${index}`,
      severity: "at-risk",
      product: escalation.productName,
      stage: escalation.stageName ?? FLAGGED_STAGE_LABEL,
      assignee: shortNameFromName(escalation.leadName),
      description: escalation.description,
    };
  }
  // unresolved_risk: surface as at-risk in the dashboard.
  return {
    id: `esc-${index}`,
    severity: "at-risk",
    product: escalation.productName,
    stage: escalation.stageName ?? NO_STAGE_LABEL,
    assignee: shortNameFromName(escalation.leadName),
    description: escalation.description,
  };
}
