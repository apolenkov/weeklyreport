import { Skeleton } from "@customreport/ui/components/ui/skeleton";

import { SlideSkeleton } from "../../../slides";

const PORTFOLIO_CARD_COUNT = 4;
const ACCORDION_COUNT = 4;

function HeaderTitleSkeleton() {
  return <Skeleton className="h-8 w-40" />;
}

function HeaderContextSkeleton() {
  return (
    <div className="min-w-0 space-y-1 sm:flex sm:items-center sm:gap-2 sm:space-y-0">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-20 sm:hidden" />
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
  return (
    <header
      data-testid="weekly-skeleton-header"
      data-layout-key="weekly-report-header"
      data-layout-stability="position-size"
      className="flex flex-wrap items-center justify-between gap-4"
    >
      <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-3 sm:basis-auto">
        <HeaderTitleSkeleton />
        <Skeleton className="h-6 w-32 rounded-[var(--radius-pill)]" />
        <HeaderContextSkeleton />
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
      <div className="flex min-w-0 max-w-full basis-full items-center gap-1.5 md:basis-auto">
        <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-56 max-w-[55vw] rounded-lg" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)]" />
      </div>
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

function PortfolioCardSkeleton() {
  return (
    <div className="grid min-h-[76px] w-full grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 overflow-hidden rounded-lg bg-[var(--color-surface-skeleton)] p-2.5">
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
    <section data-testid="weekly-skeleton-overview" className="card-surface">
      <div className="flex w-full items-center justify-between p-4">
        <div className="w-full">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-sm" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-1 h-3 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
        {Array.from({ length: PORTFOLIO_CARD_COUNT }, (_, index) => (
          <PortfolioCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

function ActivitySkeleton() {
  return (
    <section
      data-testid="weekly-skeleton-project-activities"
      className="rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[var(--card-surface-gradient)] p-4 shadow-[0_1px_2px_var(--color-border-subtle)]"
    >
      <Skeleton className="h-4 w-32" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </section>
  );
}

function SectionsToolbarSkeleton() {
  return (
    <div
      data-testid="weekly-skeleton-sections-toolbar"
      className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <Skeleton className="h-4 w-20" />
      <div className="flex max-w-full flex-wrap items-center gap-2">
        <Skeleton className="h-[var(--toolbar-control-h)] w-24 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-24 rounded-[var(--radius-pill)]" />
      </div>
    </div>
  );
}

function AccordionSkeleton() {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-44 max-w-[50vw]" />
          <Skeleton className="h-6 w-20 rounded-[var(--radius-pill)]" />
        </div>
        <Skeleton className="h-4 w-4" />
      </div>
    </div>
  );
}

function FormBodySkeleton() {
  return (
    <>
      <PortfolioSkeleton />
      <ActivitySkeleton />
      <SectionsToolbarSkeleton />
      <div className="space-y-3" data-testid="weekly-skeleton-accordions">
        {Array.from({ length: ACCORDION_COUNT }, (_, index) => (
          <AccordionSkeleton key={index} />
        ))}
      </div>
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
        <SlideSkeleton mode="head" announce={false} />
      ) : (
        <FormBodySkeleton />
      )}
    </div>
  );
}
