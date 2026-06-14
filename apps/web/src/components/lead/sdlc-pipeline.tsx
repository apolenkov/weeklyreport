"use client";

import type { CSSProperties } from "react";

import type { Product, StageAssignment, StageStatus } from "./mock-data";
import { StageChip } from "./stage-chip";
import { STAGE_CHIP_BOX_HEIGHT } from "./stage-chip-config";

export interface CrossAuthorEntry {
  projectId: string;
  projectName: string;
  authorId: string;
  authorName: string;
  stageNames: string[];
  /** Per-stage status from backend StageStatus records; undefined = legacy data without status. */
  stages?: { stageName: string; status: "green" | "yellow" | "red" | null }[];
  itemCount: number;
  riskCount: number;
  /** Per-risk details when crossAuthorSections data is loaded; null = loading. */
  risks: { severity: "blocked" | "at-risk"; text: string }[] | null;
  /** True when the author has no items and no risks for this product. */
  isEmpty: boolean;
}

interface SdlcPipelineProps {
  readonly products: Product[];
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

function worstOwnStatus(stages: StageAssignment[]): StageStatus {
  return worstStatusOf(
    stages.filter((s) => s.ownership === "mine").map((s) => s.status),
  );
}

/**
 * rethink-pipeline-state-vs-completeness (2.1): a covering risk raised by ANY
 * stage owner — including another lead on a shared product — must light the
 * left edge. Foreign severity arrives via `crossAuthors[].risks`, so the
 * health hue is max(own worst stage, worst foreign risk). `null` risks mean a
 * cross-author entry is still loading and contributes nothing.
 */
function worstForeignSeverity(
  productId: string,
  crossAuthors: readonly CrossAuthorEntry[],
): StageStatus {
  const severities = crossAuthors
    .filter((ca) => ca.projectId === productId && ca.risks !== null)
    .flatMap((ca) => ca.risks ?? [])
    .map<StageStatus>((r) =>
      r.severity === "blocked" ? "blocked" : "at-risk",
    );
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
 * rethink-pipeline-state-vs-completeness (D1): own-input completeness, over
 * the lead's OWN stages only. A stage counts as filled when its effective
 * status is anything other than "empty" (an explicit on-track or a
 * risk-derived severity both count — the lead made a choice). Foreign
 * severity never touches this counter.
 */
export interface CompletenessState {
  filled: number;
  total: number;
  complete: boolean;
}

export function computeCompleteness(product: Product): CompletenessState {
  const mine = product.stages.filter((s) => s.ownership === "mine");
  const filled = mine.filter((s) => s.status !== "empty").length;
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
  readOnly = false,
  onStatusChange,
  crossAuthors = [],
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
    <div className="space-y-4">
      {products.map((product) => {
        const completeness = computeCompleteness(product);
        // rethink-pipeline-state-vs-completeness: the completeness ring shows
        // only in edit mode while the lead's own input is unfinished. In
        // read-only mode there is nothing to finish, so it never renders.
        const showCompletenessRing =
          !readOnly && completeness.total > 0 && !completeness.complete;
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
                  {completeness.filled}/{completeness.total} stages
                </span>
              )}
            </div>

            {/* Stages row */}
            <div className="flex flex-wrap justify-center items-start gap-2 pb-1">
              {product.stages.map((stage, idx) => {
                const crossAuthorForStage = crossAuthors.find((ca) => {
                  if (ca.projectId !== product.id) return false;
                  const lower = stage.stageName.toLowerCase();
                  // Mirror the "Dev" ↔ "Development" alias from lead-form.ts:
                  // DB stage name is "Development"; chip label is "Dev".
                  return ca.stageNames.some((n) => {
                    const nl = n.toLowerCase();
                    return (
                      nl === lower ||
                      (lower === "dev" && nl === "development") ||
                      (lower === "development" && nl === "dev")
                    );
                  });
                });
                return (
                  <div key={stage.stageName} className="flex items-start gap-2">
                    {idx > 0 && (
                      <div
                        className="flex items-center text-lg font-bold"
                        style={{
                          height: STAGE_CHIP_BOX_HEIGHT,
                          color:
                            stage.ownership === "mine" ||
                            product.stages[idx - 1]?.ownership === "mine"
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
                        readOnly={readOnly}
                        onStatusChange={(name, status) =>
                          handleStatusChange(product.id, name, status)
                        }
                        crossAuthorInfo={
                          crossAuthorForStage
                            ? {
                                itemCount: crossAuthorForStage.itemCount,
                                riskCount: crossAuthorForStage.riskCount,
                              }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
