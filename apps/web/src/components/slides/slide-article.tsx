"use client";

import type { ReactNode } from "react";

import type { SectionSlideModel } from "./section-slide-utils";
import { SlideActivityPills } from "./slide-activity-pills";
import { SlideColumnHeaderRow, SlideProductCard } from "./slide-article-grid";
import {
  SlideGridHeader,
  SlideLegend,
  SlidePriorityStrip,
} from "./slide-article-header";

/**
 * The one slide article for the whole deck (lead sections AND the head's own
 * section, on every consuming surface): header → priority strip → single
 * column-header row → one card per product → legend. Auto-height canvas:
 * centered at the token max width, never clipped; below the min width the
 * deck's scroll container takes over.
 */
export function SlideArticle({
  slide,
  heroControls,
}: {
  readonly slide: SectionSlideModel;
  readonly heroControls?: ReactNode;
}) {
  const grid = slide.grid;

  if (grid === undefined) {
    // Activity-feed fallback slides carry no section, hence no grid: render
    // the identity line and the activity pill lane only.
    return (
      <article className="slide-canvas mx-auto w-full min-h-[var(--slide-canvas-min-h)] min-w-[var(--slide-canvas-min-w)] max-w-[var(--slide-canvas-max-w)] rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
          {slide.ownerName}
        </h2>
        <div className="mt-3">
          <SlideActivityPills activities={slide.activities} />
        </div>
      </article>
    );
  }

  const authorsById = new Map(grid.authors.map((a) => [a.id, a]));

  return (
    <article
      data-testid="slide-article"
      className="slide-canvas mx-auto flex w-full min-h-[var(--slide-canvas-min-h)] min-w-[var(--slide-canvas-min-w)] max-w-[var(--slide-canvas-max-w)] flex-col gap-3 rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <SlideGridHeader
        ownerName={slide.ownerName}
        grid={grid}
        heroControls={heroControls}
      />
      <SlidePriorityStrip grid={grid} authorsById={authorsById} />
      <SlideColumnHeaderRow />
      <div className="flex flex-1 flex-col gap-3">
        {grid.products.map((card) => (
          <SlideProductCard
            key={card.id}
            card={card}
            authorsById={authorsById}
          />
        ))}
        {grid.products.length === 0 && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No products on this slide
          </p>
        )}
      </div>
      <SlideLegend authors={grid.authors} />
    </article>
  );
}
