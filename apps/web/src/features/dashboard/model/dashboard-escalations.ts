import type { Escalation } from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

export interface BlockedAtRiskItem {
  id: string;
  severity: "blocked" | "at-risk";
  product: string;
  stage: string;
  assignee: string;
  description: string;
}

// Wording for a stage-keyed escalation (blocked item / unresolved risk) that
// carries no stage. Both the live and snapshot API paths return stageName=null
// identically, so this is the single place that empty case is worded.
const NO_STAGE_LABEL = "No stage set";

// A product-level "flagged red" roll-up has no stage by design, so it reads
// "Flagged" (matching the report accordion's EscalationRow) — "No stage set"
// would look like a data defect on a row that legitimately has none.
const FLAGGED_STAGE_LABEL = "Flagged";

export function escalationToBlockedItem(
  escalation: Escalation,
  index: number,
): BlockedAtRiskItem {
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
