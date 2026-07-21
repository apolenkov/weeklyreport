"use client";

import type { TrafficLightStatus } from "@customreport/shared";
import { TooltipProvider } from "@customreport/ui/components/ui/tooltip";

import type { Product, StageStatus } from "../../report-sections";
import { deriveProductPipelineView } from "../model/sdlc-pipeline-view";
import { SdlcProductCard } from "./sdlc-product-card";

export { getProductCardStyle } from "../model/sdlc-pipeline-health";

export interface CrossAuthorEntry {
  projectId: string;
  projectName: string;
  authorId: string;
  authorInitials: string;
  stageNames: string[];
  /** Per-stage RISK-DERIVED status from the cross-author query. */
  stages: { stageName: string; status: TrafficLightStatus | null }[];
}

interface SdlcPipelineProps {
  readonly products: Product[];
  /**
   * The RAW, pre-floor products used to compute own-input completeness.
   * `products` carries the risk-derived render-time floor for the
   * chips/left edge; completeness must instead count only the lead's
   * explicit per-stage choices, so it reads these. Defaults to `products`
   * when omitted (callers that already pass raw, pre-floor data).
   */
  readonly rawProducts?: readonly Product[];
  readonly readOnly?: boolean;
  readonly onStatusChange?: (
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) => void;
  /**
   * Cross-author entries for shared products. Grouped by projectId;
   * rendered as a subtle "Other contributors" row below each product card.
   */
  readonly crossAuthors?: readonly CrossAuthorEntry[];
  /**
   * lead-mine-hide-unowned-stages: which stage chips render. In "mine" only the
   * lead's own stages render — foreign-owned and vacant stages are hidden (not
   * greyed). In "everyone" the full grid renders (own + foreign-owned locked +
   * vacant). Health (left edge) and own-input completeness are always computed
   * from the full `product.stages` / `rawProduct.stages`, so hiding chips never
   * changes those signals. Defaults to "everyone" so slides / head / read-only
   * paths keep the full pipeline.
   */
  readonly visibilityMode?: "mine" | "everyone";
}

export function SdlcPipeline({
  products,
  rawProducts,
  readOnly = false,
  onStatusChange,
  crossAuthors = [],
  visibilityMode = "everyone",
}: SdlcPipelineProps) {
  function handleStatusChange(
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) {
    if (readOnly) return;
    onStatusChange?.(productId, stageName, newStatus);
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {products.map((product) => (
          <SdlcProductCard
            key={product.id}
            product={product}
            view={deriveProductPipelineView({
              product,
              rawProducts,
              crossAuthors,
              visibilityMode,
              readOnly,
            })}
            readOnly={readOnly}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
