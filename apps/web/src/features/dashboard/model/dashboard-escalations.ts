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

// A product-level "flagged red" roll-up has no stage by design, so it reads
// "Flagged" matches the report accordion's EscalationRow for a product-level
// roll-up whose absence of a concrete stage is intentional.
const FLAGGED_STAGE_LABEL = "Flagged";

export function escalationToBlockedItem(
  escalation: Escalation,
): BlockedAtRiskItem {
  if (escalation.type === "blocked") {
    return {
      severity: "blocked",
      product: escalation.productName,
      stage: escalation.stageName,
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
    stage: escalation.stageName,
    assignee: shortNameFromName(escalation.leadName),
    description: escalation.description,
  };
}
