"use client";

import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
  WeeklyProductStatus,
} from "../../report-sections";
import {
  LeadOverviewCard,
  ProductOverviewCard,
} from "./portfolio-overview-cards";

// Overview band matches report scope: product cards or lead cards (click jumps
// to that lead's section).
type PortfolioOverviewTableProps =
  | { readonly scope?: "product"; readonly products: WeeklyPortfolioProduct[] }
  | { readonly scope: "lead"; readonly leads: readonly LeadOverviewRow[] };

const STATUS_SORT: Record<WeeklyProductStatus, number> = {
  blocked: 0,
  "at-risk": 1,
  "on-track": 2,
};

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-shrink-0"
      style={{ color: "var(--color-primary)" }}
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

function pluralize(noun: string, count: number): string {
  return `${noun}${count !== 1 ? "s" : ""}`;
}

export function PortfolioOverviewTable(props: PortfolioOverviewTableProps) {
  const isLead = props.scope === "lead";
  // Lead rows arrive pre-sorted from the mapper; product rows sort here.
  const sortedProducts = isLead
    ? []
    : [...props.products].sort(
        (a, b) => STATUS_SORT[a.status] - STATUS_SORT[b.status],
      );
  const leads = isLead ? props.leads : [];

  const count = isLead ? leads.length : sortedProducts.length;
  const heading = isLead ? "Leads Overview" : "Portfolio Overview";
  const countSuffix = pluralize(isLead ? "lead" : "product", count);
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
          extends past each card and the top row's would be clipped. This
          wrapper has no collapse animation, so it has no reason to clip. */}
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
