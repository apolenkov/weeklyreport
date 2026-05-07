'use client';

import { useState } from 'react';

import type { PortfolioProduct } from '../dashboard/mock-data';

type PortfolioOverviewTableProps = {
  readonly products: PortfolioProduct[];
};

const STATUS_BG: Record<string, string> = {
  'on-track': 'var(--color-success)',
  'at-risk': '#fef3c7',
  blocked: '#fee2e2',
};

const STATUS_TEXT: Record<string, string> = {
  'on-track': 'var(--color-primary)',
  'at-risk': '#8a6d1b',
  blocked: 'var(--color-destructive)',
};

const STATUS_ICON: Record<string, string> = {
  'on-track': '\u2713',
  'at-risk': '!',
  blocked: '\u2715',
};

const STATUS_ICON_TEXT: Record<string, string> = {
  'on-track': 'var(--color-primary)',
  'at-risk': '#8a6d1b',
  blocked: 'var(--color-destructive)',
};

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-shrink-0"
      style={{ color: 'var(--color-primary)' }}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
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
      style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function PortfolioOverviewTable({ products }: PortfolioOverviewTableProps) {
  const [expanded, setExpanded] = useState(true);

  // Sort: blocked first, then at-risk, then on-track
  const sortedProducts = [...products].sort((a, b) => {
    const order: Record<string, number> = { blocked: 0, 'at-risk': 1, 'on-track': 2 };
    return (order[a.status] ?? 2) - (order[b.status] ?? 2);
  });

  return (
    <div className="mt-4 overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)]">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between p-4 transition-colors hover:bg-[#f8f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div>
          <div className="flex items-center gap-3">
            <GridIcon />
            <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
              Portfolio Overview
            </span>
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold tabular-nums text-[var(--color-muted-foreground)]">
              {products.length} products
            </span>
          </div>
          <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
            Risk products surface first. Click any card to open its matching detailed section below.
          </span>
        </div>
        <ChevronDown expanded={expanded} />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
            {sortedProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className="group relative flex cursor-pointer items-center gap-2 rounded-lg p-2.5 text-left transition-[box-shadow,filter,transform] hover:-translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_8px_18px_-14px_rgba(0,0,0,0.35),0_0_0_2px_rgba(0,117,74,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2 active:translate-y-0"
                style={{ background: STATUS_BG[product.status] }}
                title={`Open ${product.name} details`}
                onClick={() => {
                  const el = document.getElementById(`report-product-${product.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Expand the accordion if collapsed
                    const btn = el.querySelector<HTMLButtonElement>('[aria-expanded="false"]');
                    btn?.click();
                  }
                }}
              >
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    background: STATUS_BG[product.status],
                    color: STATUS_ICON_TEXT[product.status],
                    border: `1.5px solid ${STATUS_TEXT[product.status]}`,
                  }}
                >
                  {STATUS_ICON[product.status]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{product.name}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {product.statusLabel}
                  </div>
                  <span className="text-[11px] text-[var(--color-muted-foreground)]">
                    {product.currentWeekCount} current &middot; {product.nextWeekCount} next &middot; {product.riskCount} risk{product.riskCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <span
                  className="ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/55 text-[13px] font-semibold text-[var(--color-primary)] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true"
                >
                  ↓
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
