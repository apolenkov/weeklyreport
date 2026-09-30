import { Skeleton } from "@customreport/ui/components/ui/skeleton";

const ARTICLE_GRID_CLASS =
  "grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[1.35fr_1.25fr_0.85fr_0.85fr]";

function DensitySkeleton() {
  return (
    <div
      data-testid="slide-skeleton-density"
      className="inline-flex rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] p-1"
    >
      <Skeleton className="h-[var(--toolbar-control-h)] w-24 rounded-[var(--radius-pill)]" />
      <Skeleton className="h-[var(--toolbar-control-h)] w-28 rounded-[var(--radius-pill)]" />
    </div>
  );
}

function HeadCarouselSkeleton() {
  return (
    <div
      data-testid="slide-skeleton-head-carousel"
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex w-[180px] shrink-0 flex-col gap-1 rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-3 py-2.5"
        >
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function LeadCarouselSkeleton() {
  return (
    <div
      data-testid="slide-skeleton-lead-carousel"
      className="flex items-center justify-center gap-3"
    >
      <Skeleton className="h-10 w-10 rounded-[var(--radius-pill)]" />
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-10 w-10 rounded-[var(--radius-pill)]" />
    </div>
  );
}

function ArticleRowSkeleton() {
  return (
    <div className={`grid ${ARTICLE_GRID_CLASS} items-start`}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

function ArticleSkeleton() {
  return (
    <div
      className="min-w-0 max-w-full overflow-x-auto"
      data-testid="slide-skeleton-scroll-owner"
    >
      <article
        data-testid="slide-skeleton-article"
        data-layout-key="slide-article"
        data-layout-stability="position-width"
        className="slide-canvas mx-auto flex w-full min-h-[var(--slide-canvas-min-h)] min-w-0 max-w-[var(--slide-canvas-max-w)] flex-col gap-3 rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_var(--color-border-subtle)] sm:min-w-[var(--slide-canvas-min-w)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-3">
          <div className="min-w-0 max-w-full space-y-2">
            <Skeleton className="h-7 w-56 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-8 w-28 rounded-[var(--radius-pill)]" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>

        <div
          data-testid="slide-skeleton-column-headers"
          className={`hidden sm:grid ${ARTICLE_GRID_CLASS}`}
        >
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full max-w-full" />
          ))}
        </div>

        <div
          data-testid="slide-skeleton-product-card"
          className="space-y-3 rounded-[var(--radius)] border border-[var(--card-surface-border)] p-4"
        >
          <Skeleton className="h-6 w-48" />
          <ArticleRowSkeleton />
          <ArticleRowSkeleton />
        </div>

        <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--color-border-subtle)] pt-3">
          <Skeleton className="h-5 w-24 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-5 w-28 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
        </div>
      </article>
    </div>
  );
}

export function SlideSkeleton({
  mode = "head",
  announce = true,
  toolbar = mode === "head" ? "fullscreen" : "density",
}: {
  readonly mode?: "lead" | "head";
  readonly announce?: boolean;
  readonly toolbar?: "density" | "fullscreen" | "none" | undefined;
}) {
  return (
    <div
      className="min-w-0 max-w-full space-y-3"
      role={announce ? "status" : undefined}
      aria-busy={announce ? "true" : undefined}
      aria-label={announce ? "Loading slides" : undefined}
      data-testid="slide-skeleton"
      data-layout-key="status-slide-deck"
      data-layout-stability="position-width"
    >
      {toolbar === "density" ? <DensitySkeleton /> : null}
      {toolbar === "fullscreen" ? (
        <Skeleton
          data-testid="slide-skeleton-fullscreen"
          className="h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] rounded-[var(--radius-pill)]"
        />
      ) : null}
      {mode === "head" ? <HeadCarouselSkeleton /> : <LeadCarouselSkeleton />}
      <ArticleSkeleton />
    </div>
  );
}
