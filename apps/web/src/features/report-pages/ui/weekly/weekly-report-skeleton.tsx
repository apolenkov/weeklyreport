import { Skeleton } from "@weeklyreport/ui/components/ui/skeleton";

import { PeriodNavigationSkeleton } from "../../../period";
import { SlideSkeleton } from "../../../slides";

// The initial request has no data-derived layout shape. Reserve the complete
// full-report overview and do not speculate about dynamic sections below.
const PORTFOLIO_CARD_COUNT = 15;

function HeaderTitleSkeleton() {
  return (
    <>
      <h1 className="sr-only">Status Report</h1>
      <Skeleton aria-hidden="true" className="h-8 w-40" />
    </>
  );
}

function HeaderContextSkeleton({
  audience,
  mode,
}: {
  readonly audience: "head" | "viewer";
  readonly mode: "form" | "slides";
}) {
  if (audience === "viewer") {
    return (
      <div
        data-testid="weekly-skeleton-header-context"
        className="flex h-6 min-w-0 items-center gap-2"
      >
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-6 w-20 rounded-[var(--radius-pill)]" />
      </div>
    );
  }

  return (
    <div
      data-testid="weekly-skeleton-header-context"
      className={`flex h-10 min-w-0 items-start gap-2 sm:h-5 sm:items-center ${mode === "slides" ? "w-96 max-w-full" : ""}`}
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-1 h-2 w-2 sm:mt-0" />
      <div className="space-y-1 sm:space-y-0">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20 sm:hidden" />
      </div>
    </div>
  );
}

function HeaderSkeleton({
  audience,
  mode,
}: {
  readonly audience: "head" | "viewer";
  readonly mode: "form" | "slides";
}) {
  const actionWidths =
    audience === "viewer"
      ? ["w-11"]
      : mode === "slides"
        ? ["w-11", "w-36"]
        : ["w-11", "w-28", "w-36"];
  const slidesHeight =
    mode === "slides"
      ? audience === "head"
        ? "min-h-36 sm:min-h-0"
        : "min-h-32 sm:min-h-0"
      : "max-[641px]:min-h-32";
  return (
    <header
      data-testid="weekly-skeleton-header"
      data-layout-key="weekly-report-header"
      data-layout-stability="position-size"
      className={`flex flex-wrap items-center justify-between gap-4 ${slidesHeight}`}
    >
      <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-3 sm:basis-auto">
        <HeaderTitleSkeleton />
        {mode === "form" ? (
          <Skeleton
            data-testid="weekly-skeleton-status"
            className="h-6 w-32 rounded-[var(--radius-pill)]"
          />
        ) : null}
        <HeaderContextSkeleton audience={audience} mode={mode} />
      </div>
      <div
        data-testid="weekly-skeleton-document-actions"
        className="flex min-w-0 flex-wrap items-center justify-end gap-1.5"
      >
        {actionWidths.map((width) => (
          <Skeleton
            key={width}
            className={`h-[var(--toolbar-control-h)] ${width} rounded-[var(--radius-pill)]`}
          />
        ))}
      </div>
    </header>
  );
}

function ContextToolbarSkeleton() {
  return (
    <div
      data-testid="weekly-skeleton-context-toolbar"
      data-layout-key="report-context-toolbar"
      data-layout-stability="position-size"
      className="flex min-w-0 flex-wrap items-center justify-start gap-1.5 rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5"
    >
      <PeriodNavigationSkeleton testId="weekly-period-navigation-skeleton" />
      <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)]" />
      <div className="grow" aria-hidden="true" />
      <div className="contents">
        <Skeleton className="h-[var(--toolbar-control-h)] w-28 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-36 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-24 rounded-[var(--radius-pill)]" />
      </div>
    </div>
  );
}

function ViewerAcknowledgeSkeleton() {
  return (
    <div
      data-testid="weekly-skeleton-acknowledge"
      className="flex flex-wrap items-center gap-3"
      aria-hidden="true"
    >
      <Skeleton className="h-7 w-24 rounded-[var(--radius-pill)] max-md:h-[var(--touch-target-min)]" />
      <Skeleton className="h-7 w-24 rounded-[var(--radius-pill)] max-md:h-[var(--touch-target-min)]" />
    </div>
  );
}

function PortfolioCardSkeleton() {
  return (
    <div className="grid min-h-[88px] w-full grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 overflow-hidden rounded-lg bg-[var(--color-surface-skeleton)] p-2.5">
      <Skeleton className="h-7 w-7 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-40 max-w-full" />
      </div>
      <span className="h-6 w-6" aria-hidden="true" />
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <section
      data-testid="weekly-skeleton-overview"
      data-layout-key="report-overview-band"
      data-layout-stability="position-width"
      className="card-surface mt-4"
    >
      <div className="flex w-full items-center justify-between p-4">
        <div className="w-full">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-sm" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-1 h-4 w-72 max-w-full" />
        </div>
      </div>
      <div
        data-testid="weekly-skeleton-overview-grid"
        className="grid gap-2 px-4 pb-4 sm:grid-cols-2"
      >
        {Array.from({ length: PORTFOLIO_CARD_COUNT }, (_, index) => (
          <PortfolioCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

function FormBodySkeleton() {
  return (
    <>
      <PortfolioSkeleton />
      <div
        data-testid="weekly-skeleton-body-continuation"
        data-layout-key="report-body-continuation"
        data-layout-stability="position-width"
        className="min-h-px space-y-4"
      />
    </>
  );
}

export function WeeklyReportSkeleton({
  mode = "form",
  audience = "head",
}: {
  readonly mode?: "form" | "slides";
  readonly audience?: "head" | "viewer";
}) {
  return (
    <div
      role="status"
      className="space-y-4"
      aria-busy="true"
      aria-label="Loading status report"
      data-testid="weekly-report-skeleton"
      data-layout-key="report-page"
      data-layout-stability="position-width"
    >
      <HeaderSkeleton audience={audience} mode={mode} />
      <ContextToolbarSkeleton />
      {mode === "slides" ? (
        <SlideSkeleton
          mode="head"
          announce={false}
          toolbar={audience === "head" ? "none" : "fullscreen"}
        />
      ) : (
        <>
          {audience === "viewer" ? <ViewerAcknowledgeSkeleton /> : null}
          <FormBodySkeleton />
        </>
      )}
    </div>
  );
}
