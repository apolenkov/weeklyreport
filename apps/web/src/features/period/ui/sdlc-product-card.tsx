"use client";

import type { StageStatus } from "../../report-sections";
import type { Product } from "../../report-sections";
import { STAGE_CHIP_BOX_HEIGHT, StageChip } from "../../report-sections";
import type { ProductPipelineView } from "../model/sdlc-pipeline-view";
import { CollapsedStagesIndicator } from "./sdlc-collapsed-indicator";

// Empty-own-stages note copy, lifted to a const so the string is not inlined
// in JSX.
const NO_OWN_STAGES_NOTE = "No stages assigned to you";

// Label the completeness counter as the lead's OWN stages so "N/M" doesn't
// read as the whole pipeline. Pure label — the count (computeCompleteness) is
// unchanged.
const OWN_STAGES_LABEL = "Your stages";

// completeness ring geometry — named so no magic numbers leak into the style
// object.
const COMPLETENESS_RING_WIDTH = "1.5px";
const COMPLETENESS_RING_STYLE = "dashed";
const COMPLETENESS_RING_RADIUS = "var(--radius-pill)";

interface SdlcProductCardProps {
  readonly product: Product;
  readonly view: ProductPipelineView;
  readonly readOnly: boolean;
  readonly onStatusChange: (
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) => void;
}

/** One product's health card: header pill + completeness ring + stage chips row. */
export function SdlcProductCard({
  product,
  view,
  readOnly,
  onStatusChange,
}: SdlcProductCardProps) {
  const {
    rawProduct,
    cardStyle,
    completeness,
    showCompletenessRing,
    visibleStages,
    showNoOwnStagesNote,
    hiddenStages,
    hiddenReveal,
    hiddenStatuses,
    hiddenColors,
  } = view;

  return (
    <div className="rounded-xl p-4" style={cardStyle}>
      {/* Product header — an inline-flex pill featuring a *pulsing* red
      dot (`@keyframes risk-pulse` defined in globals.css) draws the eye
      to active blockers without users having to read the label. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
            {product.name}
          </span>
          {product.riskSummary && (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[rgba(200,32,20,0.08)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-destructive)]"
              title={product.riskSummary}
            >
              <span
                className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-destructive)]"
                style={{
                  animation: "risk-pulse 1.6s ease-in-out infinite",
                }}
                aria-hidden="true"
              />
              {product.riskSummary}
            </span>
          )}
        </div>
        {/* Own-input completeness affordance — RIGHT side, never the health
        hue. A dashed/dotted outline ring reads "unfinished sketch" while
        incomplete; an "N/M stages" counter pill gives the exact state.
        Neutral foreground only — health lives on the left edge. Read-only
        mode has nothing to finish, so it is hidden. */}
        {!readOnly && completeness.total > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted-foreground)]"
            style={{
              borderRadius: COMPLETENESS_RING_RADIUS,
              border: showCompletenessRing
                ? `${COMPLETENESS_RING_WIDTH} ${COMPLETENESS_RING_STYLE} var(--color-muted-foreground)`
                : `${COMPLETENESS_RING_WIDTH} solid transparent`,
            }}
            title={
              completeness.complete
                ? "Your input is complete"
                : "Set a status on every stage you own to finish your input"
            }
            data-complete={completeness.complete}
          >
            {completeness.filled}/{completeness.total} {OWN_STAGES_LABEL}
          </span>
        )}
      </div>

      {/* Stages row: a product on which the lead owns no stage still renders
      (with its honest health above) and shows a brief note instead of an
      empty grid. */}
      {showNoOwnStagesNote ? (
        <p className="pb-1 text-[13px] italic text-[var(--color-muted-foreground)]">
          {NO_OWN_STAGES_NOTE}
        </p>
      ) : (
        <div className="flex flex-wrap justify-center items-start gap-2 pb-1">
          {visibleStages.map((stage, idx) => (
            <div key={stage.stageName} className="flex items-start gap-2">
              {idx > 0 && (
                <div
                  className="flex items-center text-lg font-bold"
                  style={{
                    height: STAGE_CHIP_BOX_HEIGHT,
                    color:
                      stage.ownership === "mine" ||
                      visibleStages[idx - 1]?.ownership === "mine"
                        ? "var(--color-starbucks-accent)"
                        : "var(--color-muted-foreground)",
                  }}
                >
                  &rarr;
                </div>
              )}
              <div className="relative">
                <StageChip
                  stage={stage}
                  rawStatus={
                    rawProduct.stages.find(
                      (rs) => rs.stageName === stage.stageName,
                    )?.status ?? stage.status
                  }
                  readOnly={readOnly}
                  onStatusChange={(name, status) =>
                    onStatusChange(product.id, name, status)
                  }
                />
              </div>
            </div>
          ))}
          {/* Inert collapsed-stage indicator (Mine only): hover reveals the
            hidden stages; border+text follow the cross-author status scale. */}
          {hiddenStages.length > 0 && (
            <CollapsedStagesIndicator
              reveal={hiddenReveal}
              statuses={hiddenStatuses}
              colors={hiddenColors}
              count={hiddenStages.length}
            />
          )}
        </div>
      )}
    </div>
  );
}
