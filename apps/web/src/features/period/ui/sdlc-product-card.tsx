"use client";

import { ArrowRight } from "lucide-react";
import type { ComponentProps, CSSProperties } from "react";

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
const SDLC_STAGE_WIDE_WIDTH = "6.625rem";

interface SdlcStagesStyle extends CSSProperties {
  readonly "--sdlc-stage-width": string;
}

const SDLC_STAGES_STYLE: SdlcStagesStyle = {
  minHeight: STAGE_CHIP_BOX_HEIGHT,
  "--sdlc-stage-width": SDLC_STAGE_WIDE_WIDTH,
};

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

type StageChipProps = ComponentProps<typeof StageChip>;

function StageConnector({ isOwnEdge }: { readonly isOwnEdge: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-testid="sdlc-stage-connector"
      data-own-edge={isOwnEdge}
      className="hidden shrink-0 items-center justify-center lg:flex"
      style={{
        height: STAGE_CHIP_BOX_HEIGHT,
        color: isOwnEdge
          ? "var(--color-starbucks-accent)"
          : "var(--color-muted-foreground)",
      }}
    >
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
    </span>
  );
}

function StageStep({
  stage,
  showConnector,
  isOwnEdge,
  rawStatus,
  readOnly,
  onStatusChange,
}: {
  readonly stage: StageChipProps["stage"];
  readonly showConnector: boolean;
  readonly isOwnEdge: boolean;
  readonly rawStatus: StageChipProps["rawStatus"];
  readonly readOnly: boolean;
  readonly onStatusChange: StageChipProps["onStatusChange"];
}) {
  return (
    <>
      {showConnector && <StageConnector isOwnEdge={isOwnEdge} />}
      <div
        data-testid="sdlc-stage-row"
        className="w-full min-w-0 lg:w-[var(--sdlc-stage-width)] lg:flex-none"
      >
        <StageChip
          stage={stage}
          rawStatus={rawStatus}
          readOnly={readOnly}
          onStatusChange={onStatusChange}
        />
      </div>
    </>
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
    <div
      data-testid="sdlc-stages"
      className="grid w-full min-w-0 grid-cols-2 items-start gap-x-2 gap-y-3 pb-1 md:grid-cols-4 lg:flex lg:flex-nowrap lg:justify-center lg:gap-1"
      style={SDLC_STAGES_STYLE}
    >
      {visibleStages.map((stage, index) => (
        <StageStep
          key={stage.stageName}
          stage={stage}
          showConnector={index > 0}
          isOwnEdge={
            stage.ownership === "mine" ||
            visibleStages[index - 1]?.ownership === "mine"
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
