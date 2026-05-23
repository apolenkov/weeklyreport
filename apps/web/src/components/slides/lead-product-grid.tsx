"use client";

import { AlertTriangle, Check, Circle } from "lucide-react";

import type { SlideProduct } from "./section-slide-utils";

function StatusBadge({ status }: { status: SlideProduct["status"] }) {
  if (status === "red") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(200,32,20,0.24)] bg-[#fee2e2] px-2 py-0.5 text-[11px] font-semibold text-[#7f1d1d]">
        <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
        Blocked
      </span>
    );
  }
  if (status === "yellow") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(212,160,23,0.38)] bg-[#fef3c7] px-2 py-0.5 text-[11px] font-semibold text-[#78350f]">
        <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
        At risk
      </span>
    );
  }
  if (status === "green") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.28)] bg-[rgba(229,245,237,0.74)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
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

function ItemList({ items, empty }: { items: readonly string[]; empty: string }) {
  if (items.length === 0) {
    return (
      <p className="text-xs italic text-[var(--color-muted-foreground)]">{empty}</p>
    );
  }
  return (
    <ul className="space-y-1">
      {items.slice(0, 3).map((item, i) => (
        <li
          key={item + String(i)}
          className="text-xs leading-4 text-[var(--color-foreground)]"
        >
          · {item}
        </li>
      ))}
      {items.length > 3 ? (
        <li className="text-xs text-[var(--color-muted-foreground)]">
          +{items.length - 3} more
        </li>
      ) : null}
    </ul>
  );
}

function ProductCard({ product }: { product: SlideProduct }) {
  const isCross = product.id === "cross-product";
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-[var(--color-foreground)]">
          {product.name}
        </h3>
        {!isCross && <StatusBadge status={product.status} />}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Current
        </p>
        <ItemList items={product.currentItems} empty="No current work" />
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Next
        </p>
        <ItemList items={product.nextItems} empty="No next focus" />
      </div>

      {product.risks.length > 0 || product.decisions.length > 0 ? (
        <div className="flex flex-wrap gap-3 border-t border-[rgba(0,0,0,0.06)] pt-2">
          {product.risks.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-destructive)]">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {product.risks.length} risk{product.risks.length > 1 ? "s" : ""}
            </span>
          ) : null}
          {product.decisions.length > 0 ? (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {product.decisions.length} decision
              {product.decisions.length > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type LeadProductGridProps = {
  readonly products: readonly SlideProduct[];
};

export function LeadProductGrid({ products }: LeadProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
