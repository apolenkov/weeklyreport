"use client";

import type { CSSProperties } from "react";

import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
  WeeklyProductStatus,
} from "../../model/weekly-report-types";

const CSS_PRIMARY = "var(--color-primary)";

const STATUS_BG: Record<WeeklyProductStatus, string> = {
  "on-track": "var(--color-success)",
  "at-risk": "var(--color-status-at-risk-bg)",
  blocked: "var(--color-status-blocked-bg)",
  empty: "var(--color-surface-muted)",
};

const STATUS_TEXT: Record<WeeklyProductStatus, string> = {
  "on-track": CSS_PRIMARY,
  "at-risk": "var(--color-status-at-risk-fg)",
  blocked: "var(--color-destructive)",
  empty: "var(--color-muted-foreground)",
};

const STATUS_ICON: Record<WeeklyProductStatus, string> = {
  "on-track": "✓",
  "at-risk": "!",
  blocked: "✕",
  empty: "–",
};

const STATUS_LABEL: Record<WeeklyProductStatus, string> = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  blocked: "Blocked",
  empty: "No status",
};

const EMPTY_CARD_BG = "var(--color-surface-empty-card)";
const EMPTY_CARD_TEXT = "var(--color-muted-foreground)";
const EMPTY_BADGE_BG = "var(--color-surface-empty-badge)";
const EMPTY_BADGE_BORDER = "var(--color-border-strong)";

// Class strings are const-lifted verbatim so the emitted `class` attribute
// stays byte-identical to the inline templates they replaced.
const PRODUCT_CARD_BASE =
  "group grid min-h-[88px] w-full grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 overflow-hidden rounded-lg p-2.5 text-left transition-[box-shadow,border-color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2";
const PRODUCT_CARD_EMPTY =
  "cursor-default text-[var(--color-muted-foreground)]";
const PRODUCT_CARD_INTERACTIVE =
  "cursor-pointer hover:shadow-[var(--shadow-portfolio-card-hover)]";
const PRODUCT_CHEVRON_BASE =
  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-card)_55%,transparent)] text-[13px] font-semibold text-[var(--color-primary)] shadow-sm transition-opacity";
const PRODUCT_CHEVRON_REVEAL =
  "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100";
const STATUS_BADGE_CLASS =
  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold";

function countLabel(current: number, next: number, risks: number): string {
  return `${current} current · ${next} next · ${risks} risk${
    risks !== 1 ? "s" : ""
  }`;
}

function statusBadgeStyle(status: WeeklyProductStatus): CSSProperties {
  return {
    background: STATUS_BG[status],
    color: STATUS_TEXT[status],
    border: `1.5px solid ${STATUS_TEXT[status]}`,
  };
}

const EMPTY_BADGE_STYLE: CSSProperties = {
  background: EMPTY_BADGE_BG,
  color: EMPTY_CARD_TEXT,
  border: `1.5px solid ${EMPTY_BADGE_BORDER}`,
};

// Opening a product means scrolling its accordion into view and expanding it.
// The report surface drives this through React state (focusedProductId /
// scrollTargetProductId), never by reaching into the accordion's DOM.
export function LeadOverviewCard({
  lead,
  onNavigate,
}: {
  readonly lead: LeadOverviewRow;
  readonly onNavigate: (leadId: string) => void;
}) {
  return (
    <button
      type="button"
      className="group grid min-h-[88px] w-full cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 overflow-hidden rounded-lg p-2.5 text-left transition-[box-shadow,border-color,background-color] hover:shadow-[var(--shadow-portfolio-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2"
      style={{ background: STATUS_BG[lead.worstStatus] }}
      title={`Jump to ${lead.name}'s section`}
      onClick={() => onNavigate(lead.id)}
    >
      <div
        className={STATUS_BADGE_CLASS}
        style={statusBadgeStyle(lead.worstStatus)}
      >
        {STATUS_ICON[lead.worstStatus]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{lead.name}</div>
        <div className="min-h-8 text-xs text-[var(--color-muted-foreground)]">
          {STATUS_LABEL[lead.worstStatus]}
        </div>
        <span className="text-[11px] text-[var(--color-muted-foreground)]">
          {countLabel(lead.currentCount, lead.nextCount, lead.riskCount)}
        </span>
      </div>
      <span
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-card)_55%,transparent)] text-[13px] font-semibold text-[var(--color-primary)] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      >
        ↓
      </span>
    </button>
  );
}

function ProductCardBody({
  product,
  isEmpty,
}: {
  readonly product: WeeklyPortfolioProduct;
  readonly isEmpty: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium">{product.name}</div>
      <div
        className="min-h-8 text-xs text-[var(--color-muted-foreground)]"
        title={isEmpty ? "No updates" : product.statusLabel}
      >
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
  );
}

export function ProductOverviewCard({
  product,
  onNavigate,
  controlsDetails,
}: {
  readonly product: WeeklyPortfolioProduct;
  readonly onNavigate: (productId: string) => void;
  readonly controlsDetails: boolean;
}) {
  const isEmpty =
    product.currentWeekCount === 0 &&
    product.nextWeekCount === 0 &&
    product.riskCount === 0;
  return (
    <button
      type="button"
      className={`${PRODUCT_CARD_BASE} ${isEmpty ? PRODUCT_CARD_EMPTY : PRODUCT_CARD_INTERACTIVE}`}
      style={{
        background: isEmpty ? EMPTY_CARD_BG : STATUS_BG[product.status],
      }}
      title={isEmpty ? undefined : `Open ${product.name} details`}
      aria-controls={
        isEmpty || !controlsDetails ? undefined : `report-product-${product.id}`
      }
      disabled={isEmpty}
      aria-disabled={isEmpty}
      onClick={() => {
        if (!isEmpty) onNavigate(product.id);
      }}
    >
      <div
        className={STATUS_BADGE_CLASS}
        style={isEmpty ? EMPTY_BADGE_STYLE : statusBadgeStyle(product.status)}
      >
        {isEmpty ? "–" : STATUS_ICON[product.status]}
      </div>
      <ProductCardBody product={product} isEmpty={isEmpty} />
      <span
        className={`${PRODUCT_CHEVRON_BASE} ${isEmpty ? "opacity-0" : PRODUCT_CHEVRON_REVEAL}`}
        aria-hidden="true"
      >
        ↓
      </span>
    </button>
  );
}
