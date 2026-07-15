"use client";

import type { LeadOverviewRow } from "../model/weekly-report";
import type { WeeklyPortfolioProduct } from "../model/weekly-report-types";

// report-overview-scope-parity: the overview band follows the report's active
// scope. In `product` scope it summarizes products (unchanged); in `lead` scope
// it summarizes leads — one card per lead with content, click jumps to that
// lead's section. The grouping unit always matches the report body's unit.
type PortfolioOverviewTableProps =
  | { readonly scope?: "product"; readonly products: WeeklyPortfolioProduct[] }
  | { readonly scope: "lead"; readonly leads: readonly LeadOverviewRow[] };

const CSS_PRIMARY = "var(--color-primary)";

const STATUS_BG: Record<string, string> = {
  "on-track": "var(--color-success)",
  "at-risk": "var(--color-status-at-risk-bg)",
  blocked: "var(--color-status-blocked-bg)",
};

const STATUS_TEXT: Record<string, string> = {
  "on-track": CSS_PRIMARY,
  "at-risk": "var(--color-status-at-risk-fg)",
  blocked: "var(--color-destructive)",
};

const STATUS_ICON: Record<string, string> = {
  "on-track": "✓",
  "at-risk": "!",
  blocked: "✕",
};

const STATUS_ICON_TEXT: Record<string, string> = {
  "on-track": CSS_PRIMARY,
  "at-risk": "var(--color-status-at-risk-fg)",
  blocked: "var(--color-destructive)",
};

const STATUS_LABEL: Record<string, string> = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  blocked: "Blocked",
};

const STATUS_SORT: Record<string, number> = {
  blocked: 0,
  "at-risk": 1,
  "on-track": 2,
};

const EMPTY_CARD_BG = "rgba(0,0,0,0.045)";
const EMPTY_CARD_TEXT = "var(--color-muted-foreground)";

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-shrink-0"
      style={{ color: CSS_PRIMARY }}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

// Shared card chrome: a status-colored circle, a label column, and a hover
// "jump" arrow. The countLabel reads e.g. "3 current · 1 next · 0 risks".
function countLabel(current: number, next: number, risks: number): string {
  return `${current} current · ${next} next · ${risks} risk${
    risks !== 1 ? "s" : ""
  }`;
}

// report-overview-scope-parity: a lead overview card. Leads are never empty
// (only leads WITH content appear), so there is no muted/disabled state. A click
// scrolls + focuses the lead's section anchor; it does NOT force-expand any
// product accordion (the lead owns several products; the section is the honest
// landing target).
function LeadOverviewCard({ lead }: { readonly lead: LeadOverviewRow }) {
  return (
    <button
      type="button"
      className="group grid min-h-[76px] w-full cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 overflow-hidden rounded-lg p-2.5 text-left transition-[box-shadow,border-color,background-color] hover:shadow-[0_8px_18px_-14px_rgba(0,0,0,0.35),0_0_0_2px_rgba(0,117,74,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2"
      style={{ background: STATUS_BG[lead.worstStatus] }}
      title={`Jump to ${lead.name}'s section`}
      onClick={() => {
        const el = document.getElementById(`report-lead-${lead.id}`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // a11y parity with the product path: move focus to the section so a
        // keyboard/SR user lands there, without re-scrolling.
        if (el instanceof HTMLElement) el.focus({ preventScroll: true });
      }}
    >
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
        style={{
          background: STATUS_BG[lead.worstStatus],
          color: STATUS_ICON_TEXT[lead.worstStatus],
          border: `1.5px solid ${STATUS_TEXT[lead.worstStatus]}`,
        }}
      >
        {STATUS_ICON[lead.worstStatus]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{lead.name}</div>
        <div className="text-xs text-[var(--color-muted-foreground)]">
          {STATUS_LABEL[lead.worstStatus]}
        </div>
        <span className="text-[11px] text-[var(--color-muted-foreground)]">
          {countLabel(lead.currentCount, lead.nextCount, lead.riskCount)}
        </span>
      </div>
      <span
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/55 text-[13px] font-semibold text-[var(--color-primary)] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      >
        ↓
      </span>
    </button>
  );
}

// Existing product overview card — muted/disabled when the product has no
// content; click scrolls to the product accordion and expands it if collapsed.
function ProductOverviewCard({
  product,
}: {
  readonly product: WeeklyPortfolioProduct;
}) {
  const isEmpty =
    product.currentWeekCount === 0 &&
    product.nextWeekCount === 0 &&
    product.riskCount === 0;
  return (
    <button
      type="button"
      className={`group grid min-h-[76px] w-full grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 overflow-hidden rounded-lg p-2.5 text-left transition-[box-shadow,border-color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2 ${
        isEmpty
          ? "cursor-default text-[var(--color-muted-foreground)]"
          : "cursor-pointer hover:shadow-[0_8px_18px_-14px_rgba(0,0,0,0.35),0_0_0_2px_rgba(0,117,74,0.18)]"
      }`}
      style={{
        background: isEmpty ? EMPTY_CARD_BG : STATUS_BG[product.status],
      }}
      title={isEmpty ? undefined : `Open ${product.name} details`}
      disabled={isEmpty}
      aria-disabled={isEmpty}
      onClick={() => {
        if (isEmpty) return;
        const el = document.getElementById(`report-product-${product.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          // Expand the accordion if collapsed
          const btn = el.querySelector<HTMLButtonElement>(
            '[aria-expanded="false"]',
          );
          btn?.click();
        }
      }}
    >
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
        style={{
          background: isEmpty
            ? "rgba(255,255,255,0.35)"
            : STATUS_BG[product.status],
          color: isEmpty ? EMPTY_CARD_TEXT : STATUS_ICON_TEXT[product.status],
          border: `1.5px solid ${isEmpty ? "rgba(0,0,0,0.18)" : STATUS_TEXT[product.status]}`,
        }}
      >
        {isEmpty ? "–" : STATUS_ICON[product.status]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{product.name}</div>
        <div className="text-xs text-[var(--color-muted-foreground)]">
          {isEmpty ? "No updates" : product.statusLabel}
        </div>
        <span className="text-[11px] text-[var(--color-muted-foreground)]">
          {countLabel(
            product.currentWeekCount,
            product.nextWeekCount,
            product.riskCount,
          )}
        </span>
      </div>
      <span
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/55 text-[13px] font-semibold text-[var(--color-primary)] shadow-sm transition-opacity ${
          isEmpty
            ? "opacity-0"
            : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        }`}
        aria-hidden="true"
      >
        ↓
      </span>
    </button>
  );
}

export function PortfolioOverviewTable(props: PortfolioOverviewTableProps) {
  const isLead = props.scope === "lead";
  // Sort: blocked first, then at-risk, then on-track (lead rows arrive already
  // sorted by the mapper; product rows sort here as before).
  const sortedProducts = isLead
    ? []
    : [...props.products].sort(
        (a, b) => (STATUS_SORT[a.status] ?? 2) - (STATUS_SORT[b.status] ?? 2),
      );
  const leads = isLead ? props.leads : [];

  const count = isLead ? leads.length : sortedProducts.length;
  const heading = isLead ? "Leads Overview" : "Portfolio Overview";
  const countSuffix = isLead
    ? `lead${count !== 1 ? "s" : ""}`
    : `product${count !== 1 ? "s" : ""}`;
  const subtitle = isLead
    ? "Each lead's contribution — open their section below."
    : "Products with content open detailed sections. Empty products stay muted.";

  return (
    <div className="card-surface mt-4">
      <div className="flex w-full items-center justify-between p-4">
        <div>
          <div className="flex items-center gap-3">
            <GridIcon />
            <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
              {heading}
            </span>
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold tabular-nums text-[var(--color-muted-foreground)]">
              {count} {countSuffix}
            </span>
          </div>
          <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
            {subtitle}
          </span>
        </div>
      </div>

      {/* No overflow-hidden here: the cards' hover ring (box-shadow 0 0 0 2px)
          extends 2px past each card and the top row's ring would otherwise be
          clipped. This wrapper carries no collapse animation, so it has no
          reason to clip. */}
      <div className="min-h-0">
        <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
          {isLead
            ? leads.map((lead) => (
                <LeadOverviewCard key={lead.id} lead={lead} />
              ))
            : sortedProducts.map((product) => (
                <ProductOverviewCard key={product.id} product={product} />
              ))}
        </div>
      </div>
    </div>
  );
}
