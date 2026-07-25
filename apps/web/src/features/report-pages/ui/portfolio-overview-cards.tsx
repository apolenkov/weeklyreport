"use client";

import type { CSSProperties } from "react";

import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
  WeeklyProductStatus,
} from "../../report-sections";

const CSS_PRIMARY = "var(--color-primary)";

const STATUS_BG: Record<WeeklyProductStatus, string> = {
  "on-track": "var(--color-success)",
  "at-risk": "var(--color-status-at-risk-bg)",
  blocked: "var(--color-status-blocked-bg)",
};

const STATUS_TEXT: Record<WeeklyProductStatus, string> = {
  "on-track": CSS_PRIMARY,
  "at-risk": "var(--color-status-at-risk-fg)",
  blocked: "var(--color-destructive)",
};

const STATUS_ICON: Record<WeeklyProductStatus, string> = {
  "on-track": "✓",
  "at-risk": "!",
  blocked: "✕",
};

const STATUS_LABEL: Record<WeeklyProductStatus, string> = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  blocked: "Blocked",
};

const EMPTY_CARD_BG = "rgba(0,0,0,0.045)";
const EMPTY_CARD_TEXT = "var(--color-muted-foreground)";
const EMPTY_BADGE_BG = "rgba(255,255,255,0.35)";
const EMPTY_BADGE_BORDER = "rgba(0,0,0,0.18)";

// Class strings are const-lifted verbatim so the emitted `class` attribute
// stays byte-identical to the inline templates they replaced.
const PRODUCT_CARD_BASE =
  "group grid min-h-[76px] w-full grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 overflow-hidden rounded-lg p-2.5 text-left transition-[box-shadow,border-color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2";
const PRODUCT_CARD_EMPTY =
  "cursor-default text-[var(--color-muted-foreground)]";
const PRODUCT_CARD_INTERACTIVE =
  "cursor-pointer hover:shadow-[0_8px_18px_-14px_rgba(0,0,0,0.35),0_0_0_2px_rgba(0,117,74,0.18)]";
const PRODUCT_CHEVRON_BASE =
  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/55 text-[13px] font-semibold text-[var(--color-primary)] shadow-sm transition-opacity";
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

// Opening a product means scrolling its accordion into view and expanding it;
// an already-expanded accordion has no collapsed toggle, so nothing is clicked.
function openProductDetails(productId: string): void {
  const el = document.getElementById(`report-product-${productId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.querySelector<HTMLButtonElement>('[aria-expanded="false"]')?.click();
}

// Lead cards never empty (only leads with content); click jumps to the lead
// section, not a product accordion.
/**
 * Lead Overview Card.
 * @param options - The options argument.
 */
export function LeadOverviewCard({ lead }: { readonly lead: LeadOverviewRow }) {
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
        className={STATUS_BADGE_CLASS}
        style={statusBadgeStyle(lead.worstStatus)}
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
  );
}

/**
 * Product Overview Card.
 * @param options - The options argument.
 */
export function ProductOverviewCard({
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
      className={`${PRODUCT_CARD_BASE} ${isEmpty ? PRODUCT_CARD_EMPTY : PRODUCT_CARD_INTERACTIVE}`}
      style={{
        background: isEmpty ? EMPTY_CARD_BG : STATUS_BG[product.status],
      }}
      title={isEmpty ? undefined : `Open ${product.name} details`}
      disabled={isEmpty}
      aria-disabled={isEmpty}
      onClick={() => {
        if (!isEmpty) openProductDetails(product.id);
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
