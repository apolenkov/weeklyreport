"use client";

import { pluralize } from "../../../../shared/lib/format/pluralize";
import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
} from "../../model/weekly-report-types";
import {
  LeadOverviewCard,
  ProductOverviewCard,
} from "./portfolio-overview-cards";

// Overview band matches report scope: product cards or lead cards (click jumps
// to that lead's section). Navigation is a lifted callback — the report surface
// owns the scroll/focus state, never the DOM.
type PortfolioOverviewTableProps =
  | {
      readonly scope?: "product";
      readonly products: WeeklyPortfolioProduct[];
      readonly mountedProductIds?: ReadonlySet<string>;
      readonly onNavigate: (productId: string) => void;
    }
  | {
      readonly scope: "lead";
      readonly leads: readonly LeadOverviewRow[];
      readonly onNavigate: (leadId: string) => void;
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

function PortfolioOverviewGrid({
  props,
  products,
}: {
  readonly props: PortfolioOverviewTableProps;
  readonly products: readonly WeeklyPortfolioProduct[];
}) {
  return (
    <div className="min-h-0">
      <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
        {props.scope === "lead"
          ? props.leads.map((lead) => (
              <LeadOverviewCard
                key={lead.id}
                lead={lead}
                onNavigate={props.onNavigate}
              />
            ))
          : products.map((product) => (
              <ProductOverviewCard
                key={product.id}
                product={product}
                controlsDetails={
                  props.mountedProductIds?.has(product.id) === true
                }
                onNavigate={props.onNavigate}
              />
            ))}
      </div>
    </div>
  );
}

export function PortfolioOverviewTable(props: PortfolioOverviewTableProps) {
  const isLead = props.scope === "lead";
  // Both row kinds arrive in display order from the mapper.
  const products = isLead ? [] : props.products;
  const leads = isLead ? props.leads : [];

  const count = isLead ? leads.length : products.length;
  const heading = isLead ? "Leads Overview" : "Portfolio Overview";
  const countSuffix = isLead
    ? pluralize(count, "lead", "leads")
    : pluralize(count, "product", "products");
  const subtitle = isLead
    ? "Each lead's contribution — open their section below."
    : "Status across all authors, whatever the Sections filter shows. Products with content open detailed sections.";

  return (
    <div
      className="card-surface mt-4"
      data-layout-key="report-overview-band"
      data-layout-stability="position-width"
    >
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

      <PortfolioOverviewGrid props={props} products={products} />
    </div>
  );
}
