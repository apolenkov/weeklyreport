import { Skeleton } from "@weeklyreport/ui/components/ui/skeleton";

import {
  REPORT_TOOLBAR_FRAME_STICKY_CLASS,
  REPORT_TOOLBAR_ROW_CLASS,
} from "../../../../../shared/ui/report-shell/report-toolbar-layout";
import { SlideSkeleton } from "../../../../slides";
import {
  LEAD_HEADER_ACTIONS_BELOW_TITLE_CLASS,
  LEAD_HEADER_ROW_CLASS,
  LEAD_HEADER_TITLE_CLASS,
} from "../chrome/lead-form-header-layout";
import {
  LEAD_TOOLBAR_CONTROLS_SLOT_CLASS,
  LEAD_TOOLBAR_PERIOD_CLUSTER_CLASS,
  LEAD_TOOLBAR_PERIOD_SLOT_CLASS,
  LEAD_TOOLBAR_ROW_CLASS,
} from "../chrome/lead-form-toolbar-layout";

const EDIT_SECTION_PLACEHOLDERS = [
  { id: "product-status", rows: 3 },
  { id: "project-activities", rows: 2 },
  { id: "current-week", rows: 3 },
  { id: "next-week", rows: 3 },
  { id: "risks-blockers", rows: 2 },
  { id: "decisions", rows: 2 },
] as const;

// Mirrors ReportTitleBlock: breadcrumb row (min-h-6), h1 (text-2xl), and the
// subtitle after gap-1 plus mt-1. Sizes track the loaded text rows.
function HeaderSkeleton({ isSlidesMode }: { readonly isSlidesMode: boolean }) {
  return (
    <header
      data-testid="lead-skeleton-header"
      data-layout-key="lead-report-header"
      data-layout-stability="position-size"
      className={LEAD_HEADER_ROW_CLASS}
    >
      <div className={LEAD_HEADER_TITLE_CLASS}>
        <div className="flex min-w-0 flex-col gap-1">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-8 w-[6.5rem]" />
          <Skeleton className="mt-1 h-5 w-[14.5rem]" />
        </div>
        {!isSlidesMode ? (
          <Skeleton className="h-6 w-24 rounded-[var(--radius-pill)]" />
        ) : null}
      </div>
      <div
        data-testid="lead-skeleton-document-actions"
        className={`flex min-w-0 flex-wrap items-center justify-end gap-1.5 ${LEAD_HEADER_ACTIONS_BELOW_TITLE_CLASS}`}
      >
        <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-[var(--toolbar-control-h)] w-36 rounded-[var(--radius-pill)]" />
      </div>
    </header>
  );
}

// Same frame, row and cluster classes as the loaded ReportToolbar, so the
// period and controls clusters wrap at the same widths as the loaded page.
// Placeholder widths follow the loaded controls (desktop labels from lg up).
function ContextToolbarSkeleton({ isSlidesMode = false } = {}) {
  return (
    <div
      data-testid="lead-skeleton-context-toolbar"
      data-layout-key="report-context-toolbar"
      data-layout-stability="position-size"
      className={`${REPORT_TOOLBAR_FRAME_STICKY_CLASS} ${REPORT_TOOLBAR_ROW_CLASS} justify-start`}
    >
      <div className={LEAD_TOOLBAR_ROW_CLASS}>
        <div className={LEAD_TOOLBAR_PERIOD_SLOT_CLASS}>
          <div
            data-testid="lead-skeleton-period-cluster"
            className={LEAD_TOOLBAR_PERIOD_CLUSTER_CLASS}
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5 md:flex-none">
              <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)] md:w-[5.75rem]" />
              <Skeleton className="h-[var(--toolbar-control-h)] min-w-0 flex-1 rounded-lg md:w-[15.5rem] md:flex-none" />
              <Skeleton className="h-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)] md:w-[4.5rem]" />
            </div>
            <Skeleton className="h-5 w-px" />
            <Skeleton className="h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] rounded-[var(--radius-pill)]" />
          </div>
        </div>
        <div className={LEAD_TOOLBAR_CONTROLS_SLOT_CLASS}>
          <Skeleton className="h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] rounded-[var(--radius-pill)]" />
          <div data-testid="lead-skeleton-view-cluster" className="contents">
            <Skeleton className="h-[var(--toolbar-control-h)] w-16 rounded-[var(--radius-pill)] lg:w-48" />
            <Skeleton className="h-[var(--toolbar-control-h)] w-16 rounded-[var(--radius-pill)] lg:w-40" />
          </div>
          {isSlidesMode ? (
            <div
              data-testid="lead-skeleton-density-control"
              className="inline-flex rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] p-1"
            >
              <Skeleton className="h-[var(--toolbar-control-h)] w-44 rounded-[var(--radius-pill)]" />
            </div>
          ) : null}
          <Skeleton className="h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] rounded-[var(--radius-pill)]" />
        </div>
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
  readonly mode?: "overview" | "edit" | "slides";
}) {
  const isSlidesMode = mode === "slides";
  if (mode === "overview") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading status overview"
        data-testid="lead-form-skeleton"
        data-layout-key="report-page"
        data-layout-stability="position-width"
        className="space-y-4"
      >
        <ContextToolbarSkeleton />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-28 w-full rounded-[var(--radius)]"
          />
        ))}
      </div>
    );
  }
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
      <ContextToolbarSkeleton isSlidesMode={isSlidesMode} />
      {isSlidesMode ? (
        <SlideSkeleton mode="lead" announce={false} toolbar="none" />
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
