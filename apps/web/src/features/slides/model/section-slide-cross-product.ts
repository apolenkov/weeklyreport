import type { ReportSectionReadModel } from "@customreport/shared";

import type { SlideProduct } from "./section-slide-contracts";
import { CROSS_PRODUCT_ID, nonEmpty } from "./section-slide-model-helpers";

type ProductPredicate = (productId: string | null | undefined) => boolean;

function crossProductSlices(
  section: ReportSectionReadModel,
  isCrossProduct: ProductPredicate,
) {
  const itemTexts = (type: "current" | "next") =>
    section.items
      .filter(
        (item) =>
          item.type === type &&
          item.activityId == null &&
          isCrossProduct(item.projectId) &&
          nonEmpty(item.text),
      )
      .map((item) => item.text.trim());
  const rankedItems = section.items.filter(
    (item) =>
      item.priorityRank != null &&
      item.activityId == null &&
      isCrossProduct(item.projectId) &&
      nonEmpty(item.text),
  );
  return {
    currentItems: itemTexts("current"),
    nextItems: itemTexts("next"),
    risks: section.risks
      .filter(
        (risk) =>
          risk.activityId == null &&
          isCrossProduct(risk.projectId) &&
          nonEmpty(risk.risk),
      )
      .map((risk) => risk.risk.trim()),
    decisions: section.decisions
      .filter(
        (decision) =>
          decision.activityId == null &&
          isCrossProduct(decision.productId) &&
          nonEmpty(decision.text),
      )
      .map((decision) => decision.text.trim()),
    priorities: rankedItems.map((item) => item.text.trim()),
    itemRanks: Object.fromEntries(
      rankedItems.flatMap<readonly [string, number]>((item) =>
        item.priorityRank == null
          ? []
          : [[item.text.trim(), item.priorityRank]],
      ),
    ),
  };
}

// Null when nothing qualifies so the deck never renders an empty extra slide.
export function buildCrossProductSlide(
  section: ReportSectionReadModel,
  projectIds: ReadonlySet<string>,
): SlideProduct | null {
  const isCrossProduct = (productId: string | null | undefined) =>
    !productId || !projectIds.has(productId);
  const slices = crossProductSlices(section, isCrossProduct);
  const slide: SlideProduct = {
    id: CROSS_PRODUCT_ID,
    name: "Cross-product",
    status: null,
    stages: [],
    ...slices,
  };
  const recordCount =
    slide.currentItems.length +
    slide.nextItems.length +
    slide.risks.length +
    slide.decisions.length +
    slide.priorities.length;
  return recordCount === 0 ? null : slide;
}
