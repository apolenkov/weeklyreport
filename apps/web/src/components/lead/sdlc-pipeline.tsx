"use client";

import { OnTrackIcon } from "../ai/on-track-icon";
import { StageChip } from "./stage-chip";
import type { Product, RiskEntry, StageStatus } from "./mock-data";
import { splitStageNames } from "./stage-tags";

export type CrossAuthorEntry = {
  projectId: string;
  projectName: string;
  authorId: string;
  authorName: string;
  stageNames: string[];
  itemCount: number;
  riskCount: number;
};

type SdlcPipelineProps = {
  readonly products: Product[];
  readonly readOnly?: boolean;
  readonly onStatusChange?: (
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) => void;
  /**
   * Active `ReportSection.id` UUID — required to wire the Phase 31 AI-03
   * on-track advisory icon next to each product status badge. When absent,
   * the icon is silently skipped (e.g. data not yet settled, or running in
   * Storybook with mock data).
   */
  readonly sectionId?: string;
  /**
   * Used to count risks linked to each (product, stage) pair so the chip's
   * Clear-confirmation knows whether to prompt. The pipeline is the right
   * level to compute this once — passing the count down into every chip
   * keeps the chip itself dumb.
   */
  readonly risks?: readonly RiskEntry[];
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
   * Link drills into foreign-author readonly view (P63 LOCK-01).
   */
  readonly crossAuthors?: readonly CrossAuthorEntry[];
  /**
   * F1: Active report ID — used to build the ?authorId= drill-in URL.
   */
  readonly reportId?: string;
};

function getProductBackground(status: StageStatus): string {
  if (status === "blocked") return "#fdf8f8";
  if (status === "at-risk") return "#fffcf5";
  return "var(--color-background)";
}

function getProductBorderColor(status: StageStatus): string {
  if (status === "blocked") return "rgba(200,32,20,0.15)";
  if (status === "at-risk") return "rgba(212,160,23,0.15)";
  return "var(--color-muted)";
}

export function SdlcPipeline({
  products,
  readOnly = false,
  onStatusChange,
  sectionId,
  risks,
  unbackedStages = [],
  crossAuthors = [],
  reportId,
}: SdlcPipelineProps) {
  function handleStatusChange(
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) {
    if (readOnly) return;
    onStatusChange?.(productId, stageName, newStatus);
  }

  // Build a (productId::stageName) → count map once per render so each chip
  // can decide whether to prompt-on-Clear without recomputing.
  const riskCountByKey = new Map<string, number>();
  for (const r of risks ?? []) {
    const product = products.find((item) => item.id === r.productId);
    const stageTags =
      r.stageIds && r.stageIds.length > 0
        ? r.stageIds
        : splitStageNames(r.stageName);
    const keys =
      stageTags.length > 0
        ? stageTags.map((stageName) => `${r.productId}::${stageName}`)
        : (product?.stages ?? []).map(
            (stage) => `${r.productId}::${stage.stageName}`,
          );
    for (const key of keys) {
      riskCountByKey.set(key, (riskCountByKey.get(key) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-4">
      {!readOnly && unbackedStages.length > 0 && (
        <div
          className="rounded-lg p-3"
          style={{
            background: "#fffbeb",
            border: "1px solid rgba(212,160,23,0.35)",
          }}
          role="note"
        >
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 inline-flex items-center justify-center text-base"
              style={{ color: "#d4a017" }}
              aria-hidden="true"
            >
              ⚠
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "#8a6d1b" }}>
                {unbackedStages.length === 1
                  ? "1 stage marked at-risk/blocked has no risk written."
                  : `${unbackedStages.length} stages marked at-risk/blocked have no risk written.`}
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "#8a6d1b" }}>
                Open Risks &amp; Blockers below and use{" "}
                <strong>+ Add Risk</strong> to describe what's blocking.
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {unbackedStages.map((s) => (
                  <li
                    key={`${s.productId}::${s.stageName}`}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5"
                    style={{
                      background:
                        s.severity === "blocked" ? "#fee2e2" : "#fef3c7",
                      color:
                        s.severity === "blocked"
                          ? "var(--color-destructive)"
                          : "#8a6d1b",
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
      {products.map((product) => (
        <div
          key={product.id}
          className="rounded-xl p-4"
          style={{
            background: getProductBackground(product.overallStatus),
            border: `1px solid ${getProductBorderColor(product.overallStatus)}`,
          }}
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
            {sectionId ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Phase 31 (AI-03): on-track advisory icon next to the
                    product header. Renders ALONGSIDE — never replaces.
                    Skipped when sectionId is unavailable (mock data, pre-load). */}
                <OnTrackIcon sectionId={sectionId} projectId={product.id} />
              </div>
            ) : null}
          </div>

          {/* Stages row */}
          <div className="flex flex-wrap justify-center items-center gap-2 pb-1">
            {product.stages.map((stage, idx) => (
              <div key={stage.stageName} className="flex items-center gap-2">
                {idx > 0 && (
                  <div
                    className="flex items-center text-lg font-bold"
                    style={{
                      color:
                        stage.ownership === "mine" ||
                        product.stages[idx - 1]?.ownership === "mine"
                          ? "var(--color-starbucks-accent)"
                          : "var(--color-muted-foreground)",
                      alignSelf: "center",
                    }}
                  >
                    &rarr;
                  </div>
                )}
                <div className="relative">
                  <StageChip
                    stage={stage}
                    readOnly={readOnly}
                    linkedRiskCount={
                      riskCountByKey.get(`${product.id}::${stage.stageName}`) ??
                      0
                    }
                    onStatusChange={(name, status) =>
                      handleStatusChange(product.id, name, status)
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {/* F1: cross-author summary — other leads who share this product */}
          {crossAuthors.filter((ca) => ca.projectId === product.id).length >
            0 && (
            <div className="mt-3 border-t border-[rgba(0,0,0,0.06)] pt-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                Other contributors
              </p>
              <ul className="space-y-0.5">
                {crossAuthors
                  .filter((ca) => ca.projectId === product.id)
                  .map((ca) => (
                    <li
                      key={`${ca.projectId}::${ca.authorId}`}
                      className="flex items-center gap-1.5 text-[12px] text-[var(--color-muted-foreground)]"
                    >
                      <span className="font-medium text-[var(--color-foreground)]">
                        {ca.authorName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{ca.stageNames.join(", ")}</span>
                      <span aria-hidden="true">—</span>
                      <span>
                        {ca.itemCount} item{ca.itemCount !== 1 ? "s" : ""}
                        {ca.riskCount > 0 ? `, ${ca.riskCount} risk` : ""}
                        {ca.riskCount > 1 ? "s" : ""}
                      </span>
                      {reportId && (
                        <a
                          href={`/lead/report/${reportId}?authorId=${ca.authorId}`}
                          className="ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
                          aria-label={`View ${ca.authorName}'s section in read-only`}
                        >
                          readonly ↗
                        </a>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
