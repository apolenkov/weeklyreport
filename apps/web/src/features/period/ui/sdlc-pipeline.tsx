"use client";

import { TooltipProvider } from "@customreport/ui/components/ui/tooltip";

import type { Product, StageStatus } from "../../report-sections";
import type { CrossAuthorEntry } from "../model/sdlc-cross-author";
import { deriveProductPipelineView } from "../model/sdlc-pipeline-view";
import { SdlcProductCard } from "./sdlc-product-card";

export { getProductCardStyle } from "../model/sdlc-pipeline-health";

interface SdlcPipelineProps {
  readonly products: readonly Product[];
  // RAW pre-floor products for own-input completeness (products is risk-floored
  // for chips/left edge; completeness counts only the lead's explicit choices).
  readonly rawProducts?: readonly Product[];
  readonly readOnly?: boolean;
  readonly onStatusChange?: (
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) => void;
  readonly crossAuthors?: readonly CrossAuthorEntry[];
  // "mine" hides foreign/vacant chips; health + completeness still use full
  // product/rawProduct stages so hiding never changes those signals.
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
