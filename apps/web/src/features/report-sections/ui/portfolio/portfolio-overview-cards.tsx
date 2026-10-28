"use client";

import { shortNameFromName } from "@weeklyreport/shared";
import type { CSSProperties } from "react";

import { statusLabel } from "../../../../shared/lib/status/status-presentation";
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

const EMPTY_CARD_BG = "var(--color-surface-empty-card)";
const EMPTY_CARD_TEXT = "var(--color-muted-foreground)";
const EMPTY_BADGE_BG = "var(--color-surface-empty-badge)";
const EMPTY_BADGE_BORDER = "var(--color-border-strong)";

// Shared class tokens keep the interactive and empty product cards aligned.
const PRODUCT_CARD_BASE =
  "group grid min-h-[76px] w-full grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 overflow-hidden rounded-lg p-2.5 text-left transition-[box-shadow,border-color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2";
const PRODUCT_CARD_EMPTY =
  "cursor-default text-[var(--color-muted-foreground)]";
const PRODUCT_CARD_INTERACTIVE =
  "cursor-pointer hover:shadow-[var(--shadow-portfolio-card-hover)]";
const PRODUCT_CHEVRON_BASE =
  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-card)_55%,transparent)] text-[13px] font-semibold text-[var(--color-primary)] shadow-sm transition-opacity";
// R60: keep the jump affordance visible without hover — a reveal-on-hover-only
// chevron leaves touch/keyboard users guessing that tiles are actionable.
const PRODUCT_CHEVRON_REVEAL =
  "opacity-60 group-hover:opacity-100 group-focus-visible:opacity-100";
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
      className={`${PRODUCT_CARD_BASE} ${PRODUCT_CARD_INTERACTIVE}`}
      style={{ background: STATUS_BG[lead.worstStatus] }}
      title={`Jump to ${lead.name}'s section`}
      onClick={() => onNavigate(lead.id)}
    >
      <span
        aria-hidden="true"
        className={STATUS_BADGE_CLASS}
        style={statusBadgeStyle(lead.worstStatus)}
      >
        {STATUS_ICON[lead.worstStatus]}
      </span>
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {shortNameFromName(lead.name)}
        </span>
        <span className="block text-xs text-[var(--color-muted-foreground)]">
          {statusLabel(lead.worstStatus, "screen")}
        </span>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {countLabel(lead.currentCount, lead.nextCount, lead.riskCount)}
        </span>
      </span>
      <span
        className={`${PRODUCT_CHEVRON_BASE} ${PRODUCT_CHEVRON_REVEAL}`}
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
    <span className="block min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{product.name}</span>
      <span className="block text-xs text-[var(--color-muted-foreground)]">
        {isEmpty ? "No updates" : product.statusLabel}
      </span>
      <span className="text-xs text-[var(--color-muted-foreground)]">
        {countLabel(
          product.currentWeekCount,
          product.nextWeekCount,
          product.riskCount,
        )}
      </span>
    </span>
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
  const isEmpty = !product.hasContent;
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
      <span
        aria-hidden="true"
        className={STATUS_BADGE_CLASS}
        style={isEmpty ? EMPTY_BADGE_STYLE : statusBadgeStyle(product.status)}
      >
        {isEmpty ? "–" : STATUS_ICON[product.status]}
      </span>
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
