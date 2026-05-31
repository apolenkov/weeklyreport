"use client";

import { useEffect, useState } from "react";
import type { ProductReport } from "../dashboard/mock-data";

type ProductAccordionProps = {
  readonly report: ProductReport;
  readonly defaultOpen?: boolean;
  readonly highlighted?: boolean;
  readonly scrollIntoViewOnHighlight?: boolean;
};

type StatusConfig = {
  bg: string;
  text: string;
  avatarBg: string;
  avatarText: string;
};
type ItemStatusBadge = { bg: string; text: string; label: string };

const STATUS_CONFIG = {
  "on-track": {
    bg: "var(--color-success)",
    text: "var(--color-primary)",
    avatarBg: "var(--color-success)",
    avatarText: "var(--color-primary)",
  },
  "at-risk": {
    bg: "#fef3c7",
    text: "#8a6d1b",
    avatarBg: "#fef3c7",
    avatarText: "var(--color-starbucks-gold)",
  },
  blocked: {
    bg: "#fee2e2",
    text: "var(--color-destructive)",
    avatarBg: "#fee2e2",
    avatarText: "var(--color-destructive)",
  },
} as const satisfies Record<string, StatusConfig>;

const ITEM_STATUS_BADGE = {
  "in-progress": {
    bg: "var(--color-success)",
    text: "var(--color-primary)",
    label: "",
  },
  completed: { bg: "var(--color-primary)", text: "#fff", label: "" },
  blocked: { bg: "#fee2e2", text: "var(--color-destructive)", label: "" },
  planned: {
    bg: "var(--color-muted)",
    text: "var(--color-muted-foreground)",
    label: "Planned",
  },
} as const satisfies Record<string, ItemStatusBadge>;

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
            ? "0 0 0 2px rgba(0,117,74,0.16), 0 8px 18px -14px rgba(0,0,0,0.18)"
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
              {report.needsAttention && (
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-destructive)]">
                    Needs Attention
                  </div>
                  <div
                    className="rounded p-2.5 text-sm"
                    style={
                      report.needsAttentionSeverity === "blocked"
                        ? {
                            background: "#fee2e2",
                            color: "var(--color-destructive)",
                          }
                        : {
                            background: "#fffcf5",
                            border: "1px solid rgba(212,160,23,0.18)",
                            color: "var(--color-starbucks-gold)",
                          }
                    }
                  >
                    {report.needsAttention}
                  </div>
                </div>
              )}

              {/* Current Week */}
              {report.currentWeek.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                    Current Week &middot; {report.currentWeek.length} items
                  </div>
                  <div className="space-y-1">
                    {report.currentWeek.map((item) => {
                      const badge =
                        (ITEM_STATUS_BADGE as Record<string, ItemStatusBadge>)[
                          item.status
                        ] ?? ITEM_STATUS_BADGE["in-progress"];
                      const isBlocked = item.status === "blocked";
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded p-2 text-sm"
                          style={{
                            background: isBlocked
                              ? "#fee2e2"
                              : "var(--color-background)",
                          }}
                        >
                          <span
                            className="inline-flex flex-shrink-0 items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: badge.bg, color: badge.text }}
                          >
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
                    Next Week &middot; {report.nextWeek.length} item
                    {report.nextWeek.length !== 1 ? "s" : ""}
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
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-destructive)]">
                    Risks & Blockers &middot; {report.risks.length}
                  </div>
                  <div className="space-y-1.5">
                    {report.risks.map((risk) => {
                      const isBlocked = risk.severity === "blocked";
                      return (
                        <div
                          key={risk.id}
                          className="rounded p-2.5 text-sm"
                          style={{
                            background: isBlocked ? "#fee2e2" : "#fef3c7",
                            color: isBlocked
                              ? "var(--color-destructive)"
                              : "var(--color-starbucks-gold)",
                          }}
                        >
                          <span
                            className="mr-1 inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: isBlocked
                                ? "rgba(200,32,20,0.15)"
                                : "rgba(212,160,23,0.15)",
                              color: isBlocked
                                ? "var(--color-destructive)"
                                : "#8a6d1b",
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
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-starbucks-accent)]">
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

              {/* Priorities */}
              {report.priorities.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-starbucks-gold)]">
                    Top Priorities
                  </div>
                  <ol className="space-y-1 text-sm">
                    {report.priorities.map((p) => (
                      <li
                        key={p.rank}
                        className="flex items-center gap-2 rounded p-2"
                        style={{
                          background:
                            p.rank === 1
                              ? "#faf6ee"
                              : "var(--color-background)",
                        }}
                      >
                        <span
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            background:
                              p.rank === 1
                                ? "var(--color-starbucks-gold)"
                                : "var(--color-border)",
                            color:
                              p.rank === 1
                                ? "#fff"
                                : "var(--color-muted-foreground)",
                          }}
                        >
                          {p.rank}
                        </span>
                        {p.text}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
