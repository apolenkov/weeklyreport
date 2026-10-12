// Shared geometry for the loaded article, its skeleton and author markers.
export const SLIDE_GRID_CLASS =
  "grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[1.35fr_1.25fr_0.85fr_0.85fr]";

export const SLIDE_CANVAS_CLASS =
  "slide-canvas mx-auto flex w-full min-h-[var(--slide-canvas-min-h)] min-w-0 max-w-[var(--slide-canvas-max-w)] flex-col gap-3 rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_var(--color-border-subtle)] sm:min-w-[var(--slide-canvas-min-w)]";

export const SLIDE_ARTICLE_LAYOUT_KEY = "slide-article";

export const SLIDE_AUTHOR_BADGE_CLASS =
  "inline-flex h-[18px] w-[26px] shrink-0 items-center justify-center rounded text-xs font-semibold text-[var(--color-foreground)]";
