"use client";

import { useState } from "react";

import { RotatingChevron } from "../../../shared/ui/report-shell/rotating-chevron";
import type { BlockedAtRiskItem } from "../model/dashboard";
import { groupByProduct, ProductCard } from "./blocked-at-risk-product-card";

interface BlockedAtRiskTableProps {
  readonly items: readonly BlockedAtRiskItem[];
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-shrink-0"
      style={{ color: "var(--color-destructive)" }}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function BlockedAtRiskTable({ items }: BlockedAtRiskTableProps) {
  // head-surface-uat-polish (F4): collapsed by default. The same risk content
  // appears in the report below, so the dashboard treats this as a fast triage
  // peek the head opens on demand rather than a permanently expanded block.
  const [expanded, setExpanded] = useState(false);
  const hasItems = items.length > 0;
  const isExpanded = hasItems && expanded;
  // Cluster issues into per-product cards in the ProductAccordion idiom so a
  // product with several issues shows its name once instead of repeating it.
  const groups = groupByProduct(items);

  return (
    <div
      className={`card-surface-elevated overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] ${
        hasItems ? "card-surface-fill" : "bg-[rgba(0,0,0,0.035)]"
      }`}
    >
      <button
        type="button"
        className={`flex w-full items-center justify-between p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2 ${
          hasItems
            ? "cursor-pointer hover:bg-[var(--color-surface-hover)]"
            : "cursor-default opacity-65"
        }`}
        onClick={() => {
          if (hasItems) setExpanded(!expanded);
        }}
        disabled={!hasItems}
        aria-disabled={!hasItems}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <AlertIcon />
          <span
            className={`font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] ${
              hasItems
                ? "text-[var(--color-destructive)]"
                : "text-[var(--color-muted-foreground)]"
            }`}
          >
            Blocked & At Risk
          </span>
          <span
            className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold tabular-nums ${
              hasItems
                ? "bg-[var(--color-status-blocked-bg)] text-[var(--color-destructive)]"
                : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
            }`}
          >
            {items.length} issues
          </span>
        </div>
        <span className={hasItems ? undefined : "opacity-45"}>
          <RotatingChevron expanded={isExpanded} />
        </span>
      </button>

      {hasItems ? (
        <div
          className="grid transition-[grid-template-rows] duration-300"
          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-3 px-4 pb-4 pt-4">
              {groups.map((group) => (
                <ProductCard key={group.product} group={group} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
