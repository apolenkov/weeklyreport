"use client";

import type { ComponentProps } from "react";

import type { StageStatus } from "../../report-sections";
import type { Product } from "../../report-sections";
import { STAGE_CHIP_BOX_HEIGHT, StageChip } from "../../report-sections";
import type { ProductPipelineView } from "../model/sdlc-pipeline-view";
import { CollapsedStagesIndicator } from "./sdlc-collapsed-indicator";

const NO_OWN_STAGES_NOTE = "No stages assigned to you";

const OWN_STAGES_LABEL = "Your stages";

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

// Product header — pulsing red dot (`@keyframes risk-pulse` in app.css)
// flags active blockers without requiring the label to be read.
function ProductHeading({ product }: { readonly product: Product }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
        {product.name}
      </span>
      {product.riskSummary && (
        <span
          className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-destructive-surface-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-destructive)]"
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
  );
}

// Own-input completeness (right side, neutral): dashed ring while
// incomplete + N/M counter. Health stays on the left edge.
function CompletenessPill({
  completeness,
  showRing,
}: {
  readonly completeness: ProductPipelineView["completeness"];
  readonly showRing: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted-foreground)]"
      style={{
        borderRadius: COMPLETENESS_RING_RADIUS,
        border: showRing
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
  );
}

// Teal when either side of the gap is an own stage, so a lead's own run
// through the pipeline stays visually connected.
function StageArrow({ isOwnEdge }: { readonly isOwnEdge: boolean }) {
  return (
    <div
      className="flex items-center text-lg font-bold"
      style={{
        height: STAGE_CHIP_BOX_HEIGHT,
        color: isOwnEdge
          ? "var(--color-starbucks-accent)"
          : "var(--color-muted-foreground)",
      }}
    >
      &rarr;
    </div>
  );
}

type StageChipProps = ComponentProps<typeof StageChip>;

function StageStep({
  stage,
  showArrow,
  isOwnEdge,
  rawStatus,
  readOnly,
  onStatusChange,
}: {
  readonly stage: StageChipProps["stage"];
  readonly showArrow: boolean;
  readonly isOwnEdge: boolean;
  readonly rawStatus: StageChipProps["rawStatus"];
  readonly readOnly: boolean;
  readonly onStatusChange: StageChipProps["onStatusChange"];
}) {
  return (
    <div className="flex items-start gap-2">
      {showArrow && <StageArrow isOwnEdge={isOwnEdge} />}
      <div className="relative">
        <StageChip
          stage={stage}
          rawStatus={rawStatus}
          readOnly={readOnly}
          onStatusChange={onStatusChange}
        />
      </div>
    </div>
  );
}

interface StagesRowProps {
  readonly productId: string;
  readonly view: ProductPipelineView;
  readonly readOnly: boolean;
  readonly onStatusChange: SdlcProductCardProps["onStatusChange"];
}

function StagesRow({
  productId,
  view,
  readOnly,
  onStatusChange,
}: StagesRowProps) {
  const {
    rawProduct,
    visibleStages,
    hiddenStages,
    hiddenReveal,
    hiddenStatuses,
    hiddenColors,
  } = view;

  return (
    <div className="flex flex-wrap justify-center items-start gap-2 pb-1">
      {visibleStages.map((stage, idx) => (
        <StageStep
          key={stage.stageName}
          stage={stage}
          showArrow={idx > 0}
          isOwnEdge={
            stage.ownership === "mine" ||
            visibleStages[idx - 1]?.ownership === "mine"
          }
          rawStatus={
            rawProduct.stages.find((rs) => rs.stageName === stage.stageName)
              ?.status ?? stage.status
          }
          readOnly={readOnly}
          onStatusChange={(name, status) =>
            onStatusChange(productId, name, status)
          }
        />
      ))}
      {/* Mine-only: hover reveals hidden stages; border+text follow status scale. */}
      {hiddenStages.length > 0 && (
        <CollapsedStagesIndicator
          reveal={hiddenReveal}
          statuses={hiddenStatuses}
          colors={hiddenColors}
          count={hiddenStages.length}
        />
      )}
    </div>
  );
}

export function SdlcProductCard({
  product,
  view,
  readOnly,
  onStatusChange,
}: SdlcProductCardProps) {
  return (
    <div className="rounded-xl p-4" style={view.cardStyle}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ProductHeading product={product} />
        {!readOnly && view.completeness.total > 0 && (
          <CompletenessPill
            completeness={view.completeness}
            showRing={view.showCompletenessRing}
          />
        )}
      </div>

      {/* Stages row: products with no owned stage still render health above
      and a brief note instead of an empty grid. */}
      {view.showNoOwnStagesNote ? (
        <p className="pb-1 text-[13px] italic text-[var(--color-muted-foreground)]">
          {NO_OWN_STAGES_NOTE}
        </p>
      ) : (
        <StagesRow
          productId={product.id}
          view={view}
          readOnly={readOnly}
          onStatusChange={onStatusChange}
        />
      )}
    </div>
  );
}
