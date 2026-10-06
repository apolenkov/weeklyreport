import type { CSSProperties } from "react";

import type {
  Product,
  StageAssignment,
  StageStatus,
} from "../../report-sections";
import type { CrossAuthorEntry } from "./sdlc-cross-author";
import {
  foreignOwnersForProduct,
  hiddenStagesEffectiveStatuses,
  hiddenStagesRevealLines,
} from "./sdlc-hidden-stages";
import {
  collapsedIndicatorColors,
  type CompletenessState,
  computeCompleteness,
  getProductCardStyle,
  productHealthStatus,
} from "./sdlc-pipeline-health";

export interface ProductPipelineView {
  readonly rawProduct: Product;
  readonly cardStyle: CSSProperties;
  readonly completeness: CompletenessState;
  readonly showCompletenessRing: boolean;
  readonly visibleStages: readonly StageAssignment[];
  readonly showNoOwnStagesNote: boolean;
  readonly hiddenStages: readonly StageAssignment[];
  readonly hiddenReveal: readonly string[];
  readonly hiddenStatuses: readonly StageStatus[];
  readonly hiddenColors: { border: string; text: string };
}

// Completeness reads the RAW pre-floor product; health reads the risk-floored
// product plus crossAuthors. visibilityMode only narrows which chips render.
export function deriveProductPipelineView(args: {
  readonly product: Product;
  readonly rawProducts: readonly Product[] | undefined;
  readonly crossAuthors: readonly CrossAuthorEntry[];
  readonly visibilityMode: "mine" | "everyone";
  readonly readOnly: boolean;
}): ProductPipelineView {
  const { product, rawProducts, crossAuthors, visibilityMode, readOnly } = args;

  const rawProduct = rawProducts?.find((p) => p.id === product.id) ?? product;
  const completeness = computeCompleteness(rawProduct);
  const showCompletenessRing =
    !readOnly && completeness.total > 0 && !completeness.complete;

  const visibleStages =
    visibilityMode === "mine"
      ? product.stages.filter((s) => s.ownership === "mine")
      : product.stages;
  const showNoOwnStagesNote =
    visibilityMode === "mine" && visibleStages.length === 0;
  const hiddenStages =
    visibilityMode === "mine"
      ? product.stages.filter((s) => s.ownership !== "mine")
      : [];

  const foreignOwners = foreignOwnersForProduct(product.id, crossAuthors);
  const hiddenReveal = hiddenStagesRevealLines(hiddenStages, foreignOwners);
  const hiddenStatuses = hiddenStagesEffectiveStatuses(
    hiddenStages,
    foreignOwners,
  );
  const hiddenColors = collapsedIndicatorColors(hiddenStatuses);

  return {
    rawProduct,
    cardStyle: getProductCardStyle(productHealthStatus(product, crossAuthors)),
    completeness,
    showCompletenessRing,
    visibleStages,
    showNoOwnStagesNote,
    hiddenStages,
    hiddenReveal,
    hiddenStatuses,
    hiddenColors,
  };
}
