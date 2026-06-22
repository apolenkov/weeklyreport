"use client";

import { AlertTriangle, Check, Circle } from "lucide-react";
import type { ReactNode } from "react";

import type { SlideProduct } from "./section-slide-utils";

function StatusBadge({ status }: { status: SlideProduct["status"] }) {
  if (status === "red") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[color-mix(in_srgb,var(--color-destructive)_24%,transparent)] bg-[var(--color-status-blocked-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-destructive)]">
        <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
        Blocked
      </span>
    );
  }
  if (status === "yellow") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[color-mix(in_srgb,var(--color-status-dot-at-risk)_38%,transparent)] bg-[var(--color-status-at-risk-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-status-at-risk-fg)]">
        <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
        At risk
      </span>
    );
  }
  if (status === "green") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[color-mix(in_srgb,var(--color-starbucks-accent)_28%,transparent)] bg-[var(--color-success)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
        <Check className="h-2.5 w-2.5" aria-hidden="true" />
        On track
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.14)] bg-[var(--color-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-muted-foreground)]">
      <Circle className="h-2.5 w-2.5" aria-hidden="true" />
      No status
    </span>
  );
}

/** Bullets shown before the list collapses into a "+N more" row. */
const MAX_VISIBLE_ITEMS = 3;

function ItemList({
  items,
  empty,
}: {
  items: readonly string[];
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs italic text-[var(--color-muted-foreground)]">
        {empty}
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {items.slice(0, MAX_VISIBLE_ITEMS).map((item, i) => (
        <li
          key={item + String(i)}
          className="text-xs leading-4 text-[var(--color-foreground)]"
        >
          · {item}
        </li>
      ))}
      {items.length > MAX_VISIBLE_ITEMS ? (
        <li className="text-xs text-[var(--color-muted-foreground)]">
          +{items.length - MAX_VISIBLE_ITEMS} more
        </li>
      ) : null}
    </ul>
  );
}

/**
 * A labeled card section ("Current", "Next", "Risks (N)"). The count is folded
 * into the header so the body shows the actual content, not just a tally.
 * `className` lets a section carry a divider/spacing on top of its subgrid row.
 */
function CardSection({
  label,
  count,
  className,
  children,
}: {
  label: string;
  count?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `space-y-1 ${className}` : "space-y-1"}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
        {count != null ? (
          <span className="ml-1 font-bold text-[var(--color-muted-foreground)]">
            ({count})
          </span>
        ) : null}
      </p>
      {children}
    </div>
  );
}

/** Risk bullets with the destructive triangle marker; quiet placeholder when
 *  empty so the Risks subgrid row still holds its track. */
function RiskList({ risks }: { risks: readonly string[] }) {
  if (risks.length === 0) {
    return (
      <p className="text-xs italic text-[var(--color-muted-foreground)]">
        No risks raised
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {risks.slice(0, MAX_VISIBLE_ITEMS).map((risk, i) => (
        <li
          key={risk + String(i)}
          className="flex items-start gap-1 text-xs leading-4 text-[var(--color-foreground)]"
        >
          <AlertTriangle
            className="mt-0.5 h-3 w-3 shrink-0 text-[var(--color-destructive)]"
            aria-hidden="true"
          />
          <span>{risk}</span>
        </li>
      ))}
      {risks.length > MAX_VISIBLE_ITEMS ? (
        <li className="text-xs text-[var(--color-muted-foreground)]">
          +{risks.length - MAX_VISIBLE_ITEMS} more
        </li>
      ) : null}
    </ul>
  );
}

function ProductCard({ product }: { product: SlideProduct }) {
  const isCross = product.id === "cross-product";
  return (
    <div className="row-span-5 grid grid-rows-subgrid gap-3 rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="break-words text-sm font-semibold text-[var(--color-foreground)]">
          {product.name}
        </h3>
        {!isCross && <StatusBadge status={product.status} />}
      </div>

      <CardSection label="Current">
        <ItemList items={product.currentItems} empty="No current work" />
      </CardSection>

      <CardSection label="Next">
        <ItemList items={product.nextItems} empty="No next focus" />
      </CardSection>

      {/* lead-product-grid-alignment: Risks and Decisions are SEPARATE subgrid
          rows (5 tracks total: header + Current + Next + Risks + Decisions) so
          EACH section aligns independently across every card in the row — a
          card missing one still holds that row with a quiet placeholder rather
          than letting the next section float up. The divider sits above the
          Risks row to keep the two grouped visually. */}
      <CardSection
        label="Risks"
        count={product.risks.length > 0 ? product.risks.length : undefined}
        className="border-t border-[rgba(0,0,0,0.06)] pt-2"
      >
        <RiskList risks={product.risks} />
      </CardSection>

      <CardSection
        label="Decisions"
        count={
          product.decisions.length > 0 ? product.decisions.length : undefined
        }
      >
        <ItemList items={product.decisions} empty="No decisions" />
      </CardSection>
    </div>
  );
}

interface LeadProductGridProps {
  readonly products: readonly SlideProduct[];
}

export function LeadProductGrid({ products }: LeadProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] px-6 py-16 text-center">
        <p className="text-base font-semibold text-[var(--color-foreground)]">
          No products
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Add products to your report section to see them grouped here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
