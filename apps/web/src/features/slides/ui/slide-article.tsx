"use client";

import type { ReactNode } from "react";

import type { SectionSlideModel } from "../model/section-slide-contracts";
import type { GridAuthor, SlideGridModel } from "../model/slide-grid-model";
import { collectStageNames } from "../model/slide-grid-model";
import { SlideActivityPills } from "./slide-activity-pills";
import { SlideColumnHeaderRow, SlideProductCard } from "./slide-article-grid";
import {
  SlideGridHeader,
  SlideLegend,
  SlidePriorityStrip,
} from "./slide-article-header";
import {
  type SlideRowActivateHandler,
  StageLegend,
} from "./slide-article-rows";

// Activity-feed fallback slides carry no section, hence no grid: render
// the identity line and the activity pill lane only.
function ActivityFeedSlide({ slide }: { readonly slide: SectionSlideModel }) {
  return (
    <article className="slide-canvas mx-auto w-full min-h-[var(--slide-canvas-min-h)] min-w-[var(--slide-canvas-min-w)] max-w-[var(--slide-canvas-max-w)] rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_var(--color-border-subtle)]">
      <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
        {slide.ownerName}
      </h2>
      <div className="mt-3">
        <SlideActivityPills activities={slide.activities} />
      </div>
    </article>
  );
}

function SlideProductList({
  grid,
  authorsById,
  onRowActivate,
}: {
  readonly grid: SlideGridModel;
  readonly authorsById: ReadonlyMap<string, GridAuthor>;
  readonly onRowActivate?: SlideRowActivateHandler | undefined;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      {grid.products.map((card) => (
        <SlideProductCard
          key={card.id}
          card={card}
          authorsById={authorsById}
          onRowActivate={onRowActivate}
        />
      ))}
      {grid.products.length === 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No products on this slide
        </p>
      )}
    </div>
  );
}

// Shared slide canvas: auto-height, never clipped; deck scroll owns overflow below min width.
export function SlideArticle({
  slide,
  heroControls,
  onRowActivate,
}: {
  readonly slide: SectionSlideModel;
  readonly heroControls?: ReactNode | undefined;
  readonly onRowActivate?: SlideRowActivateHandler | undefined;
}) {
  const grid = slide.grid;

  if (grid === undefined) {
    return <ActivityFeedSlide slide={slide} />;
  }

  const authorsById = new Map(grid.authors.map((a) => [a.id, a]));

  return (
    <article
      data-testid="slide-article"
      className="slide-canvas mx-auto flex w-full min-h-[var(--slide-canvas-min-h)] min-w-[var(--slide-canvas-min-w)] max-w-[var(--slide-canvas-max-w)] flex-col gap-3 rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_var(--color-border-subtle)]"
    >
      <SlideGridHeader
        ownerName={slide.ownerName}
        grid={grid}
        heroControls={heroControls}
        pageLabel={slide.pageLabel}
      />
      <SlidePriorityStrip grid={grid} authorsById={authorsById} />
      <SlideColumnHeaderRow />
      <SlideProductList
        grid={grid}
        authorsById={authorsById}
        onRowActivate={onRowActivate}
      />
      <SlideLegend authors={grid.authors} />
      <StageLegend stageNames={collectStageNames(grid)} />
    </article>
  );
}
