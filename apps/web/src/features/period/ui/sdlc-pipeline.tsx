"use client";

import type { TrafficLightStatus } from "@customreport/shared";
import { TooltipProvider } from "@customreport/ui/components/ui/tooltip";

import type { Product, StageStatus } from "../../report-sections";
import { STAGE_CHIP_BOX_HEIGHT, StageChip } from "../../report-sections";
import {
  foreignOwnersForProduct,
  hiddenStagesEffectiveStatuses,
  hiddenStagesRevealLines,
} from "../model/sdlc-hidden-stages";
import {
  collapsedIndicatorColors,
  computeCompleteness,
  getProductCardStyle,
  productHealthStatus,
} from "../model/sdlc-pipeline-health";
import { CollapsedStagesIndicator } from "./sdlc-collapsed-indicator";

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
   * rethink-pipeline-state-vs-completeness: the RAW, pre-floor products used to
   * compute own-input completeness. `products` carries the risk-derived
   * render-time floor for the chips/left edge; completeness must instead count
   * only the lead's explicit per-stage choices, so it reads these. Defaults to
   * `products` when omitted (callers that already pass raw, pre-floor data).
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

// lead-mine-hide-unowned-stages: empty-own-stages note copy, lifted to a const
// so the string is not inlined in JSX.
const NO_OWN_STAGES_NOTE = "No stages assigned to you";

// lead-pipeline-mine-reveal-and-own-stage-label (affordance 1): label the
// completeness counter as the lead's OWN stages so "N/M" doesn't read as the
// whole pipeline. Pure label — the count (computeCompleteness) is unchanged.
const OWN_STAGES_LABEL = "Your stages";

// rethink-pipeline-state-vs-completeness: completeness ring geometry —
// named so no magic numbers leak into the style object.
const COMPLETENESS_RING_WIDTH = "1.5px";
const COMPLETENESS_RING_STYLE = "dashed";
const COMPLETENESS_RING_RADIUS = "var(--radius-pill)";

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
        {products.map((product) => {
          // Completeness reads the RAW (pre-floor) product so a risk-derived
          // severity floor never inflates the lead's own-input counter. The same
          // raw product also feeds each chip its pre-floor status, so a
          // chip floored by the lead's own risk reads "by risk" rather than
          // "status set".
          const rawProduct =
            rawProducts?.find((p) => p.id === product.id) ?? product;
          const completeness = computeCompleteness(rawProduct);
          // rethink-pipeline-state-vs-completeness: the completeness ring shows
          // only in edit mode while the lead's own input is unfinished. In
          // read-only mode there is nothing to finish, so it never renders.
          const showCompletenessRing =
            !readOnly && completeness.total > 0 && !completeness.complete;
          // lead-mine-hide-unowned-stages: in Mine only the lead's own chips
          // render; foreign-owned and vacant chips are hidden (not greyed).
          // Everyone renders the full grid. Health and completeness above read
          // the FULL `product`/`rawProduct`, so this filter never moves them.
          const visibleStages =
            visibilityMode === "mine"
              ? product.stages.filter((s) => s.ownership === "mine")
              : product.stages;
          const showNoOwnStagesNote =
            visibilityMode === "mine" && visibleStages.length === 0;
          // Affordance 2: the stages the Mine filter collapsed (complement of
          // visibleStages). Empty outside Mine mode so the indicator never shows
          // in Everyone. Read from the full `product.stages`, so health and
          // completeness (computed above from the full product) are untouched.
          const hiddenStages =
            visibilityMode === "mine"
              ? product.stages.filter((s) => s.ownership !== "mine")
              : [];
          // pipeline-tooltip-and-indicator: the +N more reveal AND its colour both
          // derive from the SAME cross-author-resolved hidden stages, so they never
          // diverge (a hidden foreign blocked stage colours red, not grey).
          const foreignOwners = foreignOwnersForProduct(
            product.id,
            crossAuthors,
          );
          const hiddenReveal = hiddenStagesRevealLines(
            hiddenStages,
            foreignOwners,
          );
          // pipeline-tooltip-and-indicator: the per-row effective statuses are
          // 1:1 with the reveal lines; reuse them for BOTH the pill colour (worst
          // status) and per-row colouring inside the popover.
          const hiddenStatuses = hiddenStagesEffectiveStatuses(
            hiddenStages,
            foreignOwners,
          );
          const hiddenColors = collapsedIndicatorColors(hiddenStatuses);
          return (
            <div
              key={product.id}
              className="rounded-xl p-4"
              style={getProductCardStyle(
                productHealthStatus(product, crossAuthors),
              )}
            >
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
                {/* rethink-pipeline-state-vs-completeness: own-input
                completeness affordance — RIGHT side, never the health hue.
                A dashed/dotted outline ring reads "unfinished sketch" while
                incomplete; an "N/M stages" counter pill gives the exact
                state. Neutral foreground only — health lives on the left
                edge. Read-only mode has nothing to finish, so it is hidden. */}
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
                    {completeness.filled}/{completeness.total}{" "}
                    {OWN_STAGES_LABEL}
                  </span>
                )}
              </div>

              {/* Stages row. lead-mine-hide-unowned-stages: a product on which the
              lead owns no stage still renders (with its honest health above)
              and shows a brief note instead of an empty grid. */}
              {showNoOwnStagesNote ? (
                <p className="pb-1 text-[13px] italic text-[var(--color-muted-foreground)]">
                  {NO_OWN_STAGES_NOTE}
                </p>
              ) : (
                <div className="flex flex-wrap justify-center items-start gap-2 pb-1">
                  {visibleStages.map((stage, idx) => {
                    return (
                      <div
                        key={stage.stageName}
                        className="flex items-start gap-2"
                      >
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
                              handleStatusChange(product.id, name, status)
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
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
        })}
      </div>
    </TooltipProvider>
  );
}
