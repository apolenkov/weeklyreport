"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight, FileText, Target } from "lucide-react";
import type { ReactNode } from "react";

import {
  CROSS_PRODUCT_LABEL,
  type UnifiedSectionRow,
  type UnifiedSlideModel,
} from "./section-slide-utils";

interface Props {
  readonly model: UnifiedSlideModel;
}

function priorityChip(rank: number): ReactNode {
  return (
    <span
      role="img"
      aria-label={`Priority ${rank}`}
      className="inline-flex shrink-0 items-center justify-center rounded-sm bg-[var(--color-starbucks-gold)] px-1 text-[10px] font-bold leading-4 text-white"
      title={`Priority rank ${rank}`}
    >
      P{rank}
    </span>
  );
}

interface ProductGroup {
  readonly productName: string;
  readonly rows: readonly UnifiedSectionRow[];
}

/* Rows are grouped by product so identity is stated ONCE per block. Group by
   product name (first-occurrence order) rather than by adjacency so a future
   re-sort of the model can never split one product into two headings. */
function groupRowsByProduct(
  rows: readonly UnifiedSectionRow[],
): readonly ProductGroup[] {
  return rows.reduce<readonly ProductGroup[]>((groups, row) => {
    const existing = groups.find((g) => g.productName === row.productName);
    if (existing) {
      return groups.map((g) =>
        g === existing
          ? { productName: g.productName, rows: [...g.rows, row] }
          : g,
      );
    }
    return [...groups, { productName: row.productName, rows: [row] }];
  }, []);
}

/* Identity is a NEUTRAL, status-free heading per product block, not a
   status-colored marker — a colored marker beside a record reads as that
   record's own severity. Status stays on the hero chip strip. Truncated with a
   `title` carrying the full name; never the old fixed-width per-row column. */
function productHeading(name: string): ReactNode {
  return (
    <span
      className="inline-flex max-w-full items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 tracking-wide text-[var(--color-muted-foreground)]"
      title={name}
      data-testid="product-heading"
    >
      <span className="truncate">{name}</span>
    </span>
  );
}

function RowList({ rows }: { readonly rows: readonly UnifiedSectionRow[] }) {
  return (
    <ul className="space-y-1.5">
      {rows.map((row, idx) => (
        <li
          key={`${row.text}-${String(idx)}`}
          className="flex min-w-0 items-baseline gap-2"
        >
          {/* Fixed-width slot so all item texts start at the same X. */}
          <span className="inline-flex w-[28px] shrink-0 justify-center">
            {row.priorityRank != null ? priorityChip(row.priorityRank) : null}
          </span>
          <span className="min-w-0 line-clamp-3 text-[13px] leading-snug text-[var(--color-foreground)]">
            {row.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function QuadrantCard({
  icon: Icon,
  label,
  items,
  emptyText,
  stripeClass,
  showHeadings,
  dashedFrame = false,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly items: readonly UnifiedSectionRow[];
  readonly emptyText: string;
  readonly stripeClass: string;
  readonly showHeadings: boolean;
  /** Feedback round 2: plans (Next focus) read as a dashed "not yet" frame. */
  readonly dashedFrame?: boolean;
}) {
  return (
    <section
      className={`relative min-h-0 overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] border-l-4 ${
        dashedFrame ? "border-dashed [border-left-style:solid]" : ""
      } ${stripeClass} bg-white/80`}
    >
      {/* lead-slide-quadrants (review fix): the ROWS scroll in this inner
          container (overflow-y-auto + min-h-0); the outer section stays
          overflow-hidden so the decorative corner watermark (negative offsets)
          is CLIPPED as before, not turned into a ~12px phantom scroll on BOTH
          axes (overflow-y-auto on the section made overflow-x compute to auto,
          so the watermark bled into a stray scrollbar on every card). */}
      <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
        {/* D4: section headers stay neutral — the stripe carries the accent. */}
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </div>
        {items.length > 0 ? (
          /* No count-based truncation — every row always renders and the card
             grows with its content; overflow scrolls in the container above.
             Rows group by product under one neutral heading when the slide spans
             more than one real product; a single-product slide renders flat. */
          <div className="mt-2 space-y-2">
            {groupRowsByProduct(items).map((group) => (
              <div key={group.productName} className="space-y-1">
                {showHeadings ? productHeading(group.productName) : null}
                <RowList rows={group.rows} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
            {emptyText}
          </p>
        )}
      </div>
      {/* D9: low-opacity watermark fills sparse cards without new assets. It
          lives on the overflow-hidden section (NOT the scroll container) so it
          is clipped and never contributes to scroll. */}
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 text-[var(--color-foreground)] opacity-[0.05]"
      />
    </section>
  );
}

/* Product headings and the chip strip only disambiguate when the slide
   aggregates more than one real product; the cross-product pseudo-entry
   never counts. Mirrors the chip-strip gate (productSlides minus
   cross-product, >1): the builder pushes every product into rows OR
   emptyProducts for each of the four rendered sections, so scanning them
   counts every real product — `priorities` (built but not rendered) is
   safely excluded. */
function countRealProducts(model: UnifiedSlideModel): number {
  const names = new Set<string>();
  const sections = [model.current, model.next, model.risks, model.decisions];
  sections
    .flat()
    .map((row) => row.productName)
    .concat(
      model.emptyProducts.current,
      model.emptyProducts.next,
      model.emptyProducts.risks,
      model.emptyProducts.decisions,
    )
    .filter((name) => name !== CROSS_PRODUCT_LABEL)
    .forEach((name) => names.add(name));
  return names.size;
}

export function LeadUnifiedSlide({ model }: Props) {
  const showHeadings = countRealProducts(model) > 1;
  return (
    /* slides-product-autofit D3: inside the fixed-aspect .slide-frame the
       grid sizes from the frame, not the viewport — flex-1/min-h-0 under the
       article's column layout replaces the old min-h-[52dvh] floor, so the
       quadrant tracks redistribute over the full frame on every content
       change (product pick, theme add). Fullscreen keeps its dvh floor.
       lead-slide-quadrants: the per-quadrant --slide-quadrant-min floor lives
       on the grid TRACK (minmax(--slide-quadrant-min, 1fr)) — not the card —
       so the floor coexists with each QuadrantCard's min-h-0 + overflow-y-auto
       scroll (the two cannot both sit on the card's min-height). */
    <div
      className="grid min-h-0 flex-1 auto-rows-[minmax(var(--slide-quadrant-min),1fr)] grid-cols-2 gap-3 [:fullscreen_&]:min-h-[60dvh] [:fullscreen_&]:content-between"
      data-testid="lead-unified-slide"
    >
      <QuadrantCard
        icon={Target}
        label="Current work"
        items={model.current}
        emptyText="Nothing in flight"
        stripeClass="border-l-[var(--color-chip-on-track-border)]"
        showHeadings={showHeadings}
      />
      <QuadrantCard
        icon={ArrowRight}
        label="Next focus"
        items={model.next}
        emptyText="Nothing queued"
        stripeClass="border-l-[var(--color-primary)]"
        showHeadings={showHeadings}
        dashedFrame
      />
      <QuadrantCard
        icon={AlertTriangle}
        label="Risks"
        items={model.risks}
        emptyText="No risks raised"
        stripeClass="border-l-[var(--color-chip-at-risk-border)]"
        showHeadings={showHeadings}
      />
      <QuadrantCard
        icon={FileText}
        label="Decisions"
        items={model.decisions}
        emptyText="No decisions recorded"
        stripeClass="border-l-[var(--color-decisions-accent)]"
        showHeadings={showHeadings}
      />
    </div>
  );
}
