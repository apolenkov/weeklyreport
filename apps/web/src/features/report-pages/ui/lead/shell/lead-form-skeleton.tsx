import { Skeleton } from "@customreport/ui/components/ui/skeleton";

import { SlideSkeleton } from "../../../../slides";

const EDIT_SECTION_PLACEHOLDERS = [
  { id: "product-status", rows: 3 },
  { id: "project-activities", rows: 2 },
  { id: "current-week", rows: 3 },
  { id: "next-week", rows: 3 },
  { id: "risks-blockers", rows: 2 },
  { id: "decisions", rows: 2 },
] as const;

function HeaderSkeleton({ isSlidesMode }: { readonly isSlidesMode: boolean }) {
  const documentActionsWrapClass = isSlidesMode ? "" : "max-[641px]:basis-full";
  return (
    <header
      data-testid="lead-skeleton-header"
      data-layout-key="lead-report-header"
      data-layout-stability="position-size"
      className="flex flex-wrap items-center justify-between gap-4"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        {!isSlidesMode ? (
          <Skeleton className="h-6 w-24 rounded-[var(--radius-pill)]" />
        ) : null}
      </div>
      <div
        data-testid="lead-skeleton-document-actions"
        className={`flex min-w-0 flex-wrap items-center justify-end gap-1.5 ${documentActionsWrapClass}`}
      >
        <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-36 rounded-[var(--radius-pill)]" />
      </div>
    </header>
  );
}

function ContextToolbarSkeleton() {
  return (
    <div
      data-testid="lead-skeleton-context-toolbar"
      data-layout-key="report-context-toolbar"
      data-layout-stability="position-size"
      className="sticky top-0 z-20 flex min-w-0 flex-wrap items-center justify-start gap-1.5 rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-2 py-1.5 shadow-md"
    >
      <div data-testid="lead-skeleton-period-cluster" className="contents">
        <div className="flex min-w-0 max-w-full basis-full items-center gap-1.5 md:basis-auto">
          <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-[var(--toolbar-control-h)] w-56 max-w-[55vw] rounded-lg" />
          <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)]" />
        </div>
        <Skeleton className="h-5 w-px" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)]" />
      </div>
      <div className="grow" aria-hidden="true" />
      <div data-testid="lead-skeleton-view-cluster" className="contents">
        <Skeleton className="h-[var(--toolbar-control-h)] w-28 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-20 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-20 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] rounded-[var(--radius-pill)]" />
      </div>
    </div>
  );
}

function EditSectionSkeleton({
  id,
  rows,
}: {
  readonly id: string;
  readonly rows: number;
}) {
  return (
    <section
      data-testid={`lead-skeleton-section-${id}`}
      className="card-surface p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-40 max-w-[50vw]" />
          <Skeleton className="h-5 w-16 rounded-[var(--radius-pill)]" />
        </div>
        <Skeleton className="h-4 w-4" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </section>
  );
}

export function LeadFormSkeleton({
  mode = "edit",
}: {
  readonly mode?: "edit" | "slides";
}) {
  const isSlidesMode = mode === "slides";
  return (
    <div
      role="status"
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading report form"
      data-testid="lead-form-skeleton"
      data-layout-key="report-page"
      data-layout-stability="position-width"
    >
      <HeaderSkeleton isSlidesMode={isSlidesMode} />
      <ContextToolbarSkeleton />
      {isSlidesMode ? (
        <SlideSkeleton mode="lead" announce={false} />
      ) : (
        <div
          data-testid="lead-skeleton-body"
          data-layout-key="lead-report-body"
          data-layout-stability="position-width"
          className="space-y-6"
        >
          {EDIT_SECTION_PLACEHOLDERS.map((placeholder) => (
            <EditSectionSkeleton key={placeholder.id} {...placeholder} />
          ))}
        </div>
      )}
    </div>
  );
}
