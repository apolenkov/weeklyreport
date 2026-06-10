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

/* Feedback round 3 (2026-06-10): rows carry a NEUTRAL product badge, not a
   status-colored dot — a colored dot next to a decision read as "this
   decision is red". Identity lives in the badge text; status stays in the
   product chip strip above. */
function productBadge(row: UnifiedSectionRow): ReactNode {
  return (
    <span
      className="inline-flex max-w-[110px] shrink-0 items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-muted)] px-1.5 text-[9px] font-semibold uppercase leading-4 tracking-wide text-[var(--color-muted-foreground)]"
      title={row.productName}
      data-testid="row-product-badge"
    >
      <span className="truncate">{row.productName}</span>
    </span>
  );
}

function QuadrantCard({
  icon: Icon,
  label,
  items,
  emptyText,
  stripeClass,
  showBadges,
  dashedFrame = false,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly items: readonly UnifiedSectionRow[];
  readonly emptyText: string;
  readonly stripeClass: string;
  readonly showBadges: boolean;
  /** Feedback round 2: plans (Next focus) read as a dashed "not yet" frame. */
  readonly dashedFrame?: boolean;
}) {
  return (
    <section
      className={`relative min-h-[var(--slide-quadrant-min)] overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] border-l-4 ${
        dashedFrame ? "border-dashed [border-left-style:solid]" : ""
      } ${stripeClass} bg-white/80 p-3`}
    >
      {/* D4: section headers stay neutral — the stripe carries the accent. */}
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      {items.length > 0 ? (
        /* Feedback round 2 (2026-06-10): no count-based truncation — every
           row always renders; the card grows with its content. */
        <ul className="mt-2 space-y-1.5">
          {items.map((row, idx) => (
            <li
              key={`${row.text}-${String(idx)}`}
              className="flex min-w-0 items-baseline gap-2"
            >
              {/* Fixed-width slot so all item texts start at the same X. */}
              <span className="inline-flex w-[28px] shrink-0 justify-center">
                {row.priorityRank != null
                  ? priorityChip(row.priorityRank)
                  : null}
              </span>
              {showBadges ? productBadge(row) : null}
              <span className="min-w-0 line-clamp-3 text-[13px] leading-snug text-[var(--color-foreground)]">
                {row.text}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
          {emptyText}
        </p>
      )}
      {/* D9: low-opacity watermark fills sparse cards without new assets. */}
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 text-[var(--color-foreground)] opacity-[0.05]"
      />
    </section>
  );
}

/* D7: row badges and the chip strip only disambiguate when the slide
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
  const showBadges = countRealProducts(model) > 1;
  return (
    /* Feedback round 2: the grid keeps a vertical floor in the normal view
       too, so the four quadrants distribute evenly instead of hugging
       content and leaving dead space below. */
    <div
      className="grid min-h-[52dvh] auto-rows-fr grid-cols-2 gap-3 [:fullscreen_&]:min-h-[60dvh] [:fullscreen_&]:content-between"
      data-testid="lead-unified-slide"
    >
      <QuadrantCard
        icon={Target}
        label="Current work"
        items={model.current}
        emptyText="Nothing in flight"
        stripeClass="border-l-[var(--color-chip-on-track-border)]"
        showBadges={showBadges}
      />
      <QuadrantCard
        icon={ArrowRight}
        label="Next focus"
        items={model.next}
        emptyText="Nothing queued"
        stripeClass="border-l-[var(--color-primary)]"
        showBadges={showBadges}
        dashedFrame
      />
      <QuadrantCard
        icon={AlertTriangle}
        label="Risks"
        items={model.risks}
        emptyText="No risks raised"
        stripeClass="border-l-[var(--color-chip-at-risk-border)]"
        showBadges={showBadges}
      />
      <QuadrantCard
        icon={FileText}
        label="Decisions"
        items={model.decisions}
        emptyText="No decisions recorded"
        stripeClass="border-l-[var(--color-decisions-accent)]"
        showBadges={showBadges}
      />
    </div>
  );
}
