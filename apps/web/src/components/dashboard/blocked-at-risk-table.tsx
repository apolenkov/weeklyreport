"use client";

import { useState } from "react";

import type { BlockedAtRiskItem } from "../../lib/mappers/dashboard";

interface BlockedAtRiskTableProps {
  readonly items: readonly BlockedAtRiskItem[];
}

type Severity = BlockedAtRiskItem["severity"];

interface ProductGroup {
  readonly product: string;
  readonly items: readonly BlockedAtRiskItem[];
}

// Mirror the ProductAccordion idiom (product-accordion.tsx): blocked is the only
// alarm hue; at-risk is carried by the row's left rail + badge, not a flooded
// fill. Tokens are shared so the dashboard and the report read identically.
const SEVERITY_TONE = {
  blocked: "var(--color-destructive)",
  "at-risk": "var(--color-status-at-risk-border)",
} as const satisfies Record<Severity, string>;

const AVATAR_CONFIG = {
  blocked: {
    bg: "var(--color-status-blocked-bg)",
    fg: "var(--color-destructive)",
  },
  "at-risk": { bg: "var(--color-muted)", fg: "var(--color-foreground)" },
} as const satisfies Record<Severity, { bg: string; fg: string }>;

const SEVERITY_BADGE = {
  blocked: {
    label: "Blocked",
    bg: "var(--color-status-blocked-bg)",
    fg: "var(--color-destructive)",
  },
  "at-risk": {
    label: "At Risk",
    bg: "var(--color-surface-muted)",
    fg: "#8a6d1b",
  },
} as const satisfies Record<
  Severity,
  { label: string; bg: string; fg: string }
>;

// One column grid shared by every issue row so all stage labels share a left
// edge and all descriptions share another, matching the report accordion.
// Columns: status rail | gutter (stage + assignee) | description | badge.
const ROW_GRID =
  "grid grid-cols-[3px_minmax(0,116px)_minmax(0,1fr)_auto] items-start gap-x-3.5";

/**
 * Clusters issues by product, preserving the first-appearance order the mapper
 * produced (escalation order), so a product carrying several issues renders as
 * one card instead of repeating its name on every row.
 */
function groupByProduct(
  items: readonly BlockedAtRiskItem[],
): readonly ProductGroup[] {
  return items.reduce<ProductGroup[]>((groups, item) => {
    const existing = groups.find((group) => group.product === item.product);
    if (existing) {
      return groups.map((group) =>
        group === existing
          ? { ...group, items: [...group.items, item] }
          : group,
      );
    }
    return [...groups, { product: item.product, items: [item] }];
  }, []);
}

// A product's worst severity drives its avatar + header dot: blocked if any of
// its issues is blocked, otherwise at-risk.
function groupSeverity(group: ProductGroup): Severity {
  return group.items.some((item) => item.severity === "blocked")
    ? "blocked"
    : "at-risk";
}

// Up to two leading initials from the product name (e.g. "Marketing Portal" →
// "MP"), the same avatar treatment the report cards use for leads.
function productInitials(product: string): string {
  return product
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

// Distinct assignees in first-appearance order, joined for the header sub-line
// (the "Василий И. · Игорь В." line in the reference card).
function assigneeLine(group: ProductGroup): string {
  return [...new Set(group.items.map((item) => item.assignee))].join(" · ");
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

function Rail({ tone }: { readonly tone: string }) {
  return (
    <span
      className="min-h-[22px] self-stretch rounded-[2px]"
      style={{ background: tone }}
      aria-hidden="true"
    />
  );
}

function IssueRow({ item }: { readonly item: BlockedAtRiskItem }) {
  const badge = SEVERITY_BADGE[item.severity];
  return (
    <div className={ROW_GRID} data-blocked-row={item.severity}>
      <Rail tone={SEVERITY_TONE[item.severity]} />
      <span className="flex min-w-0 flex-col gap-0.5 pt-px">
        <span className="truncate text-[12.5px] font-semibold text-[var(--color-foreground)]">
          {item.stage}
        </span>
        <span className="truncate text-[11px] font-medium text-[var(--color-muted-foreground)]">
          {item.assignee}
        </span>
      </span>
      <span className="pt-px text-[14px] leading-snug text-[var(--color-foreground)]">
        {item.description}
      </span>
      <span className="flex justify-end pt-px">
        <span
          className="whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: badge.bg, color: badge.fg }}
        >
          {badge.label}
        </span>
      </span>
    </div>
  );
}

function ProductCard({ group }: { readonly group: ProductGroup }) {
  const severity = groupSeverity(group);
  const tone = SEVERITY_TONE[severity];
  const avatar = AVATAR_CONFIG[severity];
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ background: avatar.bg, color: avatar.fg }}
          aria-hidden="true"
        >
          {productInitials(group.product)}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <h3 className="truncate font-[family-name:var(--font-sans)] text-[15px] font-semibold tracking-[-0.015em] text-[var(--color-foreground)]">
              {group.product}
            </h3>
            <span
              className="inline-flex flex-shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em]"
              style={{ color: tone }}
            >
              <span
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: tone }}
                aria-hidden="true"
              />
              {SEVERITY_BADGE[severity].label}
            </span>
          </div>
          <span className="truncate text-[12.5px] text-[var(--color-muted-foreground)]">
            {assigneeLine(group)}
          </span>
        </div>
      </div>
      <div className="space-y-1 border-t border-[rgba(0,0,0,0.06)] px-4 py-3">
        {group.items.map((item) => (
          <IssueRow key={item.id} item={item} />
        ))}
      </div>
    </div>
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
      className={`overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)] ${
        hasItems
          ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)]"
          : "bg-[rgba(0,0,0,0.035)]"
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
          <ChevronDown expanded={isExpanded} />
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
