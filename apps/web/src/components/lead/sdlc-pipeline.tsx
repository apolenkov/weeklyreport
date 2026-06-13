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
   * Stages the lead has marked at-risk/blocked but hasn't described in
   * the Risks list. Renders a calm advisory banner ABOVE the product
   * cards so the cause (chip colour) and the call-to-action live in
   * the same surface. Earlier this banner sat at the top of the Risks
   * section, but the link "you painted this red — describe it" reads
   * better when it's right next to the chips themselves.
   */
  readonly unbackedStages?: readonly {
    productId: string;
    productName: string;
    stageName: string;
    severity: "at-risk" | "blocked";
  }[];
  /**
   * F1: Cross-author entries for shared products. Grouped by projectId;
   * rendered as a subtle "Other contributors" row below each product card.
   */
  readonly crossAuthors?: readonly CrossAuthorEntry[];
}

// apply-status-palette (memo T5 opt 3 + user feedback 2026-06-10): every
// product card shares ONE body — neutral card surface, neutral ring — and
// only the 4px left-stripe color changes with status (same idiom as the
// unbacked-risk advisory above). paddingLeft compensates the 3px-wider
// left border so content padding reads equal on all sides.
const STRIPE_BY_STATUS: Record<StageStatus, string> = {
  blocked: "var(--color-chip-blocked-border)",
  "at-risk": "var(--color-status-at-risk-border)",
  "on-track": "var(--color-chip-on-track-border)",
  empty: "var(--color-border)",
};

// D1: derive stripe color from the worst status among the lead's own stages.
// Severity order: blocked > at-risk > on-track > empty (empty = nothing set yet).
const SEVERITY_RANK: Record<StageStatus, number> = {
  blocked: 3,
  "at-risk": 2,
  "on-track": 1,
  empty: 0,
};

function worstOwnStatus(stages: StageAssignment[]): StageStatus {
  return stages
    .filter((s) => s.ownership === "mine")
    .reduce<StageStatus>(
      (worst, s) =>
        SEVERITY_RANK[s.status] > SEVERITY_RANK[worst] ? s.status : worst,
      "empty",
    );
}

export function getProductCardStyle(
  status: StageStatus,
  dashed: boolean,
): CSSProperties {
  return {
    background: "var(--color-card)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderLeft: `4px ${dashed ? "dashed" : "solid"} ${STRIPE_BY_STATUS[status]}`,
    paddingLeft: "calc(1rem - 3px)",
  };
}

export function SdlcPipeline({
  products,
  readOnly = false,
  onStatusChange,
  unbackedStages = [],
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
      {!readOnly && unbackedStages.length > 0 && (
        <div
          className="rounded-lg p-3"
          style={{
            // User feedback 2026-06-10: the advisory must NOT read as
            // another product card — muted amber band (chip at-risk tint),
            // no card ring and no left stripe (the stripe idiom belongs to
            // the product-card status language).
            background: "var(--color-chip-at-risk-bg)",
          }}
          role="note"
        >
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 inline-flex items-center justify-center text-base"
              style={{ color: "var(--color-status-at-risk-border)" }}
              aria-hidden="true"
            >
              ⚠
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--color-chip-at-risk-text)]">
                {unbackedStages.length === 1
                  ? "1 stage has no matching risk written."
                  : `${unbackedStages.length} stages have no matching risk written.`}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--color-chip-at-risk-text)]">
                Open Risks &amp; Blockers below and use{" "}
                <strong>+ Add Risk</strong> to describe what's blocking.
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {unbackedStages.map((s) => (
                  <li
                    key={`${s.productId}::${s.stageName}`}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5"
                    style={{
                      // Pills sit ON the amber band — white body keeps them
                      // legible there.
                      background: "var(--color-card)",
                      color:
                        s.severity === "blocked"
                          ? "var(--color-chip-blocked-text)"
                          : "var(--color-chip-at-risk-text)",
                    }}
                  >
                    <span className="font-semibold">
                      {s.severity === "blocked" ? "✕" : "!"}
                    </span>
                    <span>{s.productName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{s.stageName}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      {products.map((product) => {
        const hasUnfilledOwnStage =
          !readOnly &&
          product.stages.some(
            (s) => s.ownership === "mine" && s.status === "empty",
          );
        return (
          <div
            key={product.id}
            className="rounded-xl p-4"
            style={getProductCardStyle(
              worstOwnStatus(product.stages),
              hasUnfilledOwnStage,
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
