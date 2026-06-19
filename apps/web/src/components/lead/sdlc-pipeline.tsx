"use client";

import type { CSSProperties } from "react";

import { trafficToStageStatus } from "../../lib/mappers/traffic-light";
import { useSdlcTooltip } from "../ui/sdlc-tooltip";
import type { Product, StageAssignment, StageStatus } from "./mock-data";
import { StageChip } from "./stage-chip";
import { STAGE_CHIP_BOX_HEIGHT, STATUS_CONFIG } from "./stage-chip-config";

export interface CrossAuthorEntry {
  projectId: string;
  projectName: string;
  authorId: string;
  authorInitials: string;
  stageNames: string[];
  /** Per-stage RISK-DERIVED status from the cross-author query. */
  stages: { stageName: string; status: "green" | "yellow" | "red" | null }[];
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
   * F1: Cross-author entries for shared products. Grouped by projectId;
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

// lead-pipeline-mine-reveal-and-own-stage-label (affordance 2): in Mine mode
// the filter hides foreign-owned and vacant chips. A small inert indicator near
// the grid reports how many stages are collapsed; its `title` (hover) and
// `aria-label` (non-visual) reveal each hidden stage's name and status,
// mirroring the inert ComingSoon control pattern in nav-bar.tsx. It never
// un-hides the chips, nor touches health or completeness.
const HIDDEN_STAGES_ARIA_PREFIX = "Hidden stages —";

// "Name: status" mirrors the per-chip aria convention (e.g. "DevOps: blocked").
function hiddenStagesRevealText(hidden: readonly StageAssignment[]): string {
  return hidden.map((s) => `${s.stageName}: ${s.status}`).join(", ");
}

function collapsedStagesIndicatorLabel(count: number): string {
  return `+${count} more`;
}

// apply-status-palette (memo T5 opt 3 + user feedback 2026-06-10): every
// product card shares ONE body — neutral card surface, neutral ring — and
// only the 4px left-stripe color changes with the HEALTH status.
// rethink-pipeline-state-vs-completeness: the left edge is ALWAYS solid and
// only carries health (severity). The completeness signal lives on the right
// (dashed ring + N/M counter) and never shares this hue. paddingLeft
// compensates the 3px-wider left border so content padding reads equal.
const STRIPE_BY_STATUS: Record<StageStatus, string> = {
  blocked: "var(--color-chip-blocked-border)",
  "at-risk": "var(--color-status-at-risk-border)",
  "on-track": "var(--color-chip-on-track-border)",
  empty: "var(--color-border)",
};

// Health severity order: blocked > at-risk > on-track > empty
// (empty = nothing set yet).
const SEVERITY_RANK: Record<StageStatus, number> = {
  blocked: 3,
  "at-risk": 2,
  "on-track": 1,
  empty: 0,
};

// rethink-pipeline-state-vs-completeness (D2): completeness ring geometry —
// named so no magic numbers leak into the style object.
const COMPLETENESS_RING_WIDTH = "1.5px";
const COMPLETENESS_RING_STYLE = "dashed";
const COMPLETENESS_RING_RADIUS = "var(--radius-pill)";

function worstStatusOf(values: readonly StageStatus[]): StageStatus {
  return values.reduce<StageStatus>(
    (worst, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[worst] ? s : worst),
    "empty",
  );
}

// lead-demo-feedback #90: the collapsed `+N more` indicator takes the worst
// hidden stage's status colour, but ONLY when that worst is blocked/at-risk.
// An on-track/empty hidden set stays neutral grey — a green "+N" would wrongly
// read as "the hidden stages are fine", which is noise, not the signal the
// reviewer asked for. Neutral matches the indicator's prior look.
const NEUTRAL_INDICATOR_COLORS = {
  border: "var(--color-border)",
  text: "var(--color-muted-foreground)",
} as const;

function collapsedIndicatorColors(hidden: readonly StageAssignment[]): {
  border: string;
  text: string;
} {
  const worst = worstStatusOf(hidden.map((s) => s.status));
  if (worst === "blocked" || worst === "at-risk") {
    return {
      border: STATUS_CONFIG[worst].border,
      text: STATUS_CONFIG[worst].text,
    };
  }
  return NEUTRAL_INDICATOR_COLORS;
}

function worstOwnStatus(stages: StageAssignment[]): StageStatus {
  return worstStatusOf(
    stages.filter((s) => s.ownership === "mine").map((s) => s.status),
  );
}

/**
 * rethink-pipeline-state-vs-completeness (2.1): a stage status raised by ANY
 * stage owner — including another lead on a shared product — must light the
 * left edge. Foreign status arrives RISK-DERIVED via `crossAuthors[].stages`
 * (the server folds covering risks into the per-stage traffic light), so the
 * health hue is max(own worst stage, worst foreign stage). An `empty`/`null`
 * foreign stage contributes nothing.
 */
function worstForeignSeverity(
  productId: string,
  crossAuthors: readonly CrossAuthorEntry[],
): StageStatus {
  const severities = crossAuthors
    .filter((ca) => ca.projectId === productId)
    .flatMap((ca) => ca.stages)
    .map<StageStatus>((s) => trafficToStageStatus(s.status));
  return worstStatusOf(severities);
}

function productHealthStatus(
  product: Product,
  crossAuthors: readonly CrossAuthorEntry[],
): StageStatus {
  return worstStatusOf([
    worstOwnStatus(product.stages),
    worstForeignSeverity(product.id, crossAuthors),
  ]);
}

/**
 * fix-report-surface-integrity W11 (reverses the earlier
 * rethink-pipeline-state-vs-completeness D1 invariant): own-input completeness,
 * over the lead's OWN stages only. A stage counts as filled when EITHER the lead
 * set an explicit status on it (status !== "empty") OR the lead deliberately
 * staged their OWN risk on it (the RAW `coveredByOwnRisk` flag — a stage they
 * addressed via the risk surface). It MUST still be fed the RAW product (the
 * mapper/bridge derive `coveredByOwnRisk` strictly from persisted own risks that
 * EXPLICITLY name the stage), NEVER the risk-derived render-time severity floor:
 * the floor colors empty AND foreign-covered stages, so counting it would inflate
 * the counter for stages the lead never touched. The old "all stages checked"
 * footgun is removed at the source — the Add Risk dialog no longer defaults to
 * every owned stage (W11 task 3.10). Foreign severity never touches this counter.
 */
export interface CompletenessState {
  filled: number;
  total: number;
  complete: boolean;
}

export function computeCompleteness(product: Product): CompletenessState {
  const mine = product.stages.filter((s) => s.ownership === "mine");
  const filled = mine.filter(
    (s) => s.status !== "empty" || s.coveredByOwnRisk === true,
  ).length;
  return {
    filled,
    total: mine.length,
    complete: mine.length > 0 && filled === mine.length,
  };
}

export function getProductCardStyle(status: StageStatus): CSSProperties {
  return {
    background: "var(--color-card)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderLeft: `4px solid ${STRIPE_BY_STATUS[status]}`,
    paddingLeft: "calc(1rem - 3px)",
  };
}

export function SdlcPipeline({
  products,
  rawProducts,
  readOnly = false,
  onStatusChange,
  crossAuthors = [],
  visibilityMode = "everyone",
}: SdlcPipelineProps) {
  // lead-demo-feedback #89: the collapsed `+N more` indicator drives the same
  // styled tooltip the chips use (provider already wraps this surface via the
  // lead-form). No-op when no provider is mounted (unit tests in isolation).
  const tooltip = useSdlcTooltip();

  function handleStatusChange(
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) {
    if (readOnly) return;
    onStatusChange?.(productId, stageName, newStatus);
  }

  return (
    <div className="space-y-4">
      {products.map((product) => {
        // Completeness reads the RAW (pre-floor) product so a risk-derived
        // severity floor never inflates the lead's own-input counter. The same
        // raw product also feeds each chip its pre-floor status (W11 3.9), so a
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
        return (
          <div
            key={product.id}
            className="rounded-xl p-4"
            style={getProductCardStyle(
              productHealthStatus(product, crossAuthors),
            )}
          >
            {/* Product header — SDLC-1 (Phase 33-04): replace plain riskSummary
              text with an inline-flex pill featuring a *pulsing* red dot
              (`@keyframes risk-pulse` defined in globals.css). Mockup s2
              uses this to draw the eye to active blockers without users
              having to read the label. */}
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
              {/* rethink-pipeline-state-vs-completeness (D2): own-input
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
                  {completeness.filled}/{completeness.total} {OWN_STAGES_LABEL}
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
                {/* Affordance 2 (+ #89/#90): inert collapsed-stage indicator.
                    Shows only in Mine mode (hiddenStages is empty otherwise) and
                    only when the lead owns at least one stage (this grid branch).
                    #89: hover/focus drives the SAME styled tooltip the chips use
                    (the native `title` is gone); the aria-label still reveals the
                    hidden stages to screen readers. #90: border+text take the
                    worst hidden status colour when blocked/at-risk. It never
                    re-renders the chips, nor touches health/completeness. */}
                {hiddenStages.length > 0 &&
                  (() => {
                    const reveal = hiddenStagesRevealText(hiddenStages);
                    const colors = collapsedIndicatorColors(hiddenStages);
                    return (
                      <span
                        role="img"
                        data-testid="collapsed-stages-indicator"
                        aria-label={`${HIDDEN_STAGES_ARIA_PREFIX} ${reveal}`}
                        className="inline-flex cursor-default items-center rounded-[var(--radius-pill)] border border-dashed px-2 text-[12px] font-medium"
                        style={{
                          height: STAGE_CHIP_BOX_HEIGHT,
                          borderColor: colors.border,
                          color: colors.text,
                        }}
                        onMouseEnter={(e) =>
                          tooltip.show(
                            e.currentTarget.getBoundingClientRect(),
                            reveal,
                          )
                        }
                        onMouseLeave={() => tooltip.hide()}
                      >
                        {collapsedStagesIndicatorLabel(hiddenStages.length)}
                      </span>
                    );
                  })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
