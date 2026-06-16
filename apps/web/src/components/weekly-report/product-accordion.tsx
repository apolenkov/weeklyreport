"use client";

import { useEffect, useState } from "react";

import { pluralize } from "../../lib/pluralize";
import type { ProductReport } from "../dashboard/mock-data";

interface ProductAccordionProps {
  readonly report: ProductReport;
  readonly defaultOpen?: boolean;
  readonly highlighted?: boolean;
  readonly scrollIntoViewOnHighlight?: boolean;
}

interface StatusConfig {
  bg: string;
  text: string;
  avatarBg: string;
  avatarText: string;
}

// apply-status-palette (memo T6 opt 2): red is the only alarm hue (blocked);
// at-risk goes neutral here — the amber signal lives on the row's left
// stripe, not on a flooded amber fill. No hardcoded status hex.
const STATUS_CONFIG = {
  "on-track": {
    bg: "var(--color-success)",
    text: "var(--color-primary)",
    avatarBg: "var(--color-success)",
    avatarText: "var(--color-primary)",
  },
  "at-risk": {
    bg: "var(--color-muted)",
    text: "var(--color-foreground)",
    avatarBg: "var(--color-muted)",
    avatarText: "var(--color-foreground)",
  },
  blocked: {
    bg: "var(--color-status-blocked-bg)",
    text: "var(--color-destructive)",
    avatarBg: "var(--color-status-blocked-bg)",
    avatarText: "var(--color-destructive)",
  },
} as const satisfies Record<string, StatusConfig>;

// report-card-clarity: the stage chip is an IDENTITY label (stage + initials),
// rendered with one uniform treatment regardless of workflow status. The
// workflow-status signal moves to the row's left stripe (below), so the chip
// no longer encodes status in its fill. All colors resolve through named tokens.
const STAGE_CHIP_CLASS =
  "inline-flex flex-shrink-0 items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted-foreground)]";

// Workflow-status → row left-stripe color (named tokens only). EVERY workflow
// status carries a visible, distinct marker so the chip can stay status-free
// (status-color-semantics): blocked → red (the only alarm hue), completed →
// solid success green, in-progress → neutral grey. The light --color-success
// *tint* is a fill, not a stripe color — too pale to read at 3px, which is why
// completed uses --color-success-foreground here.
function itemStripeColor(status: string): string {
  if (status === "blocked") return "var(--color-destructive)";
  if (status === "completed") return "var(--color-success-foreground)";
  if (status === "in-progress") return "var(--color-muted-foreground)";
  return "var(--color-border)";
}

// Prioritized items first (rank 1, 2, …), the rest keep their order.
function sortByPriority<T extends { priorityRank?: number | null }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      (a.priorityRank ?? Number.MAX_SAFE_INTEGER) -
      (b.priorityRank ?? Number.MAX_SAFE_INTEGER),
  );
}

// Gold rank badge for prioritized items — replaces the former TOP
// PRIORITIES section, which duplicated current-week items 1:1.
function PriorityRankBadge({ rank }: { readonly rank: number }) {
  return (
    <span
      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{
        background:
          rank === 1 ? "var(--color-starbucks-gold)" : "var(--color-border)",
        color:
          rank === 1
            ? "var(--color-primary-foreground)"
            : "var(--color-muted-foreground)",
      }}
      title={`Priority ${rank}`}
    >
      {rank}
    </span>
  );
}

function ChevronDown({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-[var(--color-muted-foreground)] transition-transform duration-300"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ProductAccordion({
  report,
  defaultOpen = false,
  highlighted = false,
  scrollIntoViewOnHighlight = false,
}: ProductAccordionProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const hasContent =
    Boolean(report.needsAttention) ||
    report.currentWeek.length > 0 ||
    report.nextWeek.length > 0 ||
    report.risks.length > 0 ||
    report.decisions.length > 0 ||
    report.priorities.length > 0;
  const isEmpty = !hasContent;
  const config = isEmpty
    ? {
        bg: "var(--color-muted)",
        text: "var(--color-muted-foreground)",
        avatarBg: "var(--color-muted)",
        avatarText: "var(--color-muted-foreground)",
      }
    : ((STATUS_CONFIG as Record<string, StatusConfig>)[report.status] ??
      STATUS_CONFIG["on-track"]);
  const statusLabel = isEmpty ? "No updates" : report.statusLabel;

  // report-card-clarity: suppress the "Needs Attention" banner when its text is
  // verbatim one of the item rows already rendered in this card — the escalation
  // is DERIVED from a blocked item, so it would otherwise repeat that row. A
  // distinct head-facing summary (no exact item match) still renders.
  const renderedItemTexts = new Set([
    ...report.currentWeek.map((item) => item.text),
    ...report.nextWeek.map((item) => item.text),
  ]);
  const showNeedsAttention =
    Boolean(report.needsAttention) &&
    !renderedItemTexts.has(report.needsAttention ?? "");

  useEffect(() => {
    if (highlighted && hasContent) setExpanded(true);
  }, [highlighted, hasContent]);

  useEffect(() => {
    if (!highlighted || !scrollIntoViewOnHighlight) return;
    const handle = window.setTimeout(() => {
      document
        .getElementById(`report-product-${report.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(handle);
  }, [highlighted, report.id, scrollIntoViewOnHighlight]);

  return (
    <div
      id={`report-product-${report.id}`}
      className={`scroll-mt-28 overflow-hidden rounded-[var(--radius)] border shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)] transition-[border-color,box-shadow] ${
        isEmpty
          ? "bg-[rgba(0,0,0,0.035)] opacity-90"
          : "bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)]"
      }`}
      style={{
        borderColor:
          highlighted && hasContent
            ? "var(--color-starbucks-accent)"
            : "rgba(0,0,0,0.10)",
        boxShadow:
          highlighted && hasContent
            ? "0 0 0 2px var(--color-highlight-shadow), 0 8px 18px -14px rgba(0,0,0,0.18)"
            : undefined,
      }}
    >
      <button
        type="button"
        className={`flex w-full items-center justify-between p-4 transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2 ${
          hasContent
            ? "cursor-pointer hover:bg-[var(--color-surface-muted)]"
            : "cursor-default bg-[var(--color-background)] opacity-65"
        }`}
        onClick={() => {
          if (hasContent) setExpanded(!expanded);
        }}
        disabled={!hasContent}
        aria-disabled={!hasContent}
        aria-expanded={hasContent ? expanded : false}
        data-product-accordion-toggle="true"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5 pr-3">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
            style={{ background: config.avatarBg, color: config.avatarText }}
          >
            {report.initials}
          </div>
          <span className="min-w-0 truncate font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em]">
            {report.name}
          </span>
          <span
            className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: config.bg, color: config.text }}
          >
            {statusLabel}
          </span>
          <span
            className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-medium ${
              isEmpty
                ? "bg-[rgba(0,0,0,0.06)] text-[var(--color-muted-foreground)]"
                : "bg-[var(--color-success)] text-[var(--color-primary)]"
            }`}
          >
            {report.leads}
          </span>
        </div>
        {hasContent ? (
          <ChevronDown expanded={expanded} />
        ) : (
          <span className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        )}
      </button>

      {hasContent ? (
        <div
          className="grid transition-[grid-template-rows] duration-300"
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-3 border-t border-[rgba(0,0,0,0.06)] px-4 pb-4 pt-4">
              {/* Needs Attention */}
              {showNeedsAttention && (
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                    Needs Attention
                  </div>
                  <div
                    className="rounded p-2.5 text-sm"
                    style={
                      report.needsAttentionSeverity === "blocked"
                        ? {
                            background: "var(--color-status-blocked-bg)",
                            color: "var(--color-destructive)",
                          }
                        : {
                            background: "var(--color-surface-muted)",
                            borderLeft:
                              "3px solid var(--color-status-at-risk-border)",
                            color: "var(--color-foreground)",
                          }
                    }
                  >
                    {report.needsAttention}
                  </div>
                </div>
              )}

              {/* Current Week. User feedback 2026-06-10: the separate TOP
                  PRIORITIES section duplicated these items 1:1 — instead,
                  prioritized items sort first and carry a rank badge
                  inline. */}
              {report.currentWeek.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                    Current Week &middot; {report.currentWeek.length}{" "}
                    {pluralize(report.currentWeek.length, "item", "items")}
                  </div>
                  <div className="space-y-1">
                    {sortByPriority(report.currentWeek).map((item) => {
                      const isBlocked = item.status === "blocked";
                      const stripe = itemStripeColor(item.status);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded p-2 text-sm"
                          style={{
                            background: isBlocked
                              ? "var(--color-status-blocked-bg)"
                              : item.priorityRank === 1
                                ? "var(--color-priority-row-bg)"
                                : "var(--color-background)",
                            borderLeft: `3px solid ${stripe}`,
                          }}
                        >
                          {item.priorityRank != null && (
                            <PriorityRankBadge rank={item.priorityRank} />
                          )}
                          <span className={STAGE_CHIP_CLASS}>
                            {item.status === "planned"
                              ? "Planned"
                              : item.stageLead}
                          </span>
                          {item.text}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Next Week */}
              {report.nextWeek.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                    Next Week &middot; {report.nextWeek.length}{" "}
                    {pluralize(report.nextWeek.length, "item", "items")}
                  </div>
                  <div className="space-y-1">
                    {report.nextWeek.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded p-2 text-sm"
                        style={{
                          background: "var(--color-background)",
                          border: "1px dashed var(--color-border)",
                        }}
                      >
                        <span className="inline-flex flex-shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted-foreground)]">
                          Planned
                        </span>
                        {item.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risks & Blockers */}
              {report.risks.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                    Risks & Blockers &middot; {report.risks.length}
                  </div>
                  <div className="space-y-1.5">
                    {report.risks.map((risk) => {
                      const isBlocked = risk.severity === "blocked";
                      return (
                        <div
                          key={risk.id}
                          className="rounded p-2.5 text-sm"
                          style={
                            isBlocked
                              ? {
                                  background: "var(--color-status-blocked-bg)",
                                  color: "var(--color-destructive)",
                                }
                              : {
                                  background: "var(--color-surface-muted)",
                                  borderLeft:
                                    "3px solid var(--color-status-at-risk-border)",
                                  color: "var(--color-foreground)",
                                }
                          }
                        >
                          <span
                            className="mr-1 inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: isBlocked
                                ? "var(--color-status-blocked-bg)"
                                : "var(--color-muted)",
                              color: isBlocked
                                ? "var(--color-destructive)"
                                : "var(--color-muted-foreground)",
                            }}
                          >
                            {risk.badge}
                          </span>
                          {risk.text}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {report.decisions.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                    Decisions &middot; {report.decisions.length}
                  </div>
                  <div className="space-y-1.5">
                    {report.decisions.map((decision) => (
                      <div
                        key={decision.id}
                        className="rounded p-2.5 text-sm"
                        style={{ background: "var(--color-background)" }}
                      >
                        <span className="mr-1 inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
                          {decision.badge}
                        </span>
                        {decision.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* The former TOP PRIORITIES section is gone (user feedback
                  2026-06-10): it duplicated current-week items verbatim.
                  Ranks now render inline via PriorityRankBadge above. */}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
