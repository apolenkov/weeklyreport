import type { Escalation } from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

// Presentation row for one escalation. The shared wire model carries no record
// identity, so this row is explicitly unkeyed — list consumers use a local
// render key, never a synthesized persisted-looking id.
export interface BlockedAtRiskItem {
  readonly severity: "blocked" | "at-risk";
  readonly product: string;
  readonly stage: string;
  readonly assignee: string;
  readonly description: string;
}

export interface ProductGroup {
  readonly product: string;
  readonly items: readonly BlockedAtRiskItem[];
}

export function groupByProduct(
  items: readonly BlockedAtRiskItem[],
): readonly ProductGroup[] {
  return [...Map.groupBy(items, (item) => item.product)].map(
    ([product, group]) => ({ product, items: group }),
  );
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
): BlockedAtRiskItem {
  if (escalation.type === "blocked") {
    return {
      severity: "blocked",
      product: escalation.productName,
      stage: escalation.stageName ?? NO_STAGE_LABEL,
      assignee: shortNameFromName(escalation.leadName),
      description: escalation.description,
    };
  }
  if (escalation.type === "at_risk") {
    return {
      severity: "at-risk",
      product: escalation.productName,
      stage: escalation.stageName ?? FLAGGED_STAGE_LABEL,
      assignee: shortNameFromName(escalation.leadName),
      description: escalation.description,
    };
  }
  // unresolved_risk: surface as at-risk in the dashboard.
  return {
    severity: "at-risk",
    product: escalation.productName,
    stage: escalation.stageName ?? NO_STAGE_LABEL,
    assignee: shortNameFromName(escalation.leadName),
    description: escalation.description,
  };
}
