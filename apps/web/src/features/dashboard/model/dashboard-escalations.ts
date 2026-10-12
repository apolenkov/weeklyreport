import type { Escalation } from "@weeklyreport/shared";
import { shortNameFromName } from "@weeklyreport/shared";

// Presentation row for one escalation. Product and author identities remain
// available for grouping and rendering even when display names collide.
export interface BlockedAtRiskItem {
  readonly productId: string;
  readonly authorId: string;
  readonly severity: "blocked" | "at-risk";
  readonly productFlaggedRed?: boolean;
  readonly product: string;
  readonly stage: string;
  readonly assignee: string;
  readonly description: string;
}

export interface ProductGroup {
  readonly productId: string;
  readonly product: string;
  readonly items: readonly BlockedAtRiskItem[];
}

export function groupByProduct(
  items: readonly BlockedAtRiskItem[],
): readonly ProductGroup[] {
  return [...Map.groupBy(items, (item) => item.productId)].flatMap(
    ([productId, group]) => {
      const first = group[0];
      return first ? [{ productId, product: first.product, items: group }] : [];
    },
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
      productId: escalation.productId,
      authorId: escalation.authorId,
      severity: "blocked",
      product: escalation.productName,
      stage: escalation.stageName,
      assignee: shortNameFromName(escalation.leadName),
      description: escalation.description,
    };
  }
  if (escalation.type === "at_risk") {
    return {
      productId: escalation.productId,
      authorId: escalation.authorId,
      severity: "at-risk",
      product: escalation.productName,
      stage: escalation.stageName ?? FLAGGED_STAGE_LABEL,
      assignee: shortNameFromName(escalation.leadName),
      description: escalation.description,
    };
  }
  // unresolved_risk: surface as at-risk in the dashboard.
  return {
    productId: escalation.productId,
    authorId: escalation.authorId,
    severity: "at-risk",
    product: escalation.productName,
    stage: escalation.stageName,
    assignee: shortNameFromName(escalation.leadName),
    description: escalation.description,
  };
}

/** Assigns distinct occurrence keys without merging identical risk rows. */
export function keyIssues(
  items: readonly BlockedAtRiskItem[],
): readonly { readonly key: string; readonly item: BlockedAtRiskItem }[] {
  const occurrences = new Map<string, number>();
  return items.map((item) => {
    const contentKey = `${item.productId}|${item.authorId}|${item.stage}|${item.severity}|${item.description}`;
    const occurrence = occurrences.get(contentKey) ?? 0;
    occurrences.set(contentKey, occurrence + 1);
    return { key: `${contentKey}|${occurrence}`, item };
  });
}
