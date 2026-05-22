"use client";

import { Suspense, useState } from "react";

import { ViewModeToggle } from "../report-shell/view-mode-toggle";
import { ScopeToggle, type ScopeValue } from "../report-shell/scope-toggle";
import { WeeklyReportPage } from "../weekly-report/weekly-report-page";
import { WeeklyReportSkeleton } from "../weekly-report/weekly-report-skeleton";
import { HeadSlidesClient } from "../slides/head-slides-client";
import { SlideSkeleton } from "../slides/slide-skeleton";

type HeadReportShellProps = {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId?: string;
};

/**
 * Phase 61 (robust-baking-aurora): inline form ↔ slides mode toggle for the
 * head status report page. Mirrors the pattern from lead-form.tsx.
 */
export function HeadReportShell({
  reportId,
  mode,
  authorId,
}: HeadReportShellProps) {
  const authorSuffix = authorId
    ? `?authorId=${encodeURIComponent(authorId)}`
    : "";
  const editHref = `/head/report/${encodeURIComponent(reportId)}${authorSuffix}`;
  const slidesHref =
    `/head/report/${encodeURIComponent(reportId)}?mode=slides` +
    (authorId ? `&authorId=${encodeURIComponent(authorId)}` : "");

  // Grouping axis for the form-mode status pane (UAT 2026-05-22): product (the
  // classic per-product list) or lead (products bucketed under each lead).
  const [scope, setScope] = useState<ScopeValue>("product");
  const reportScope = scope === "lead" ? "lead" : "product";

  const presentHref = `/head/report/${encodeURIComponent(reportId)}/present`;
  const printHref = `/print/${encodeURIComponent(reportId)}`;

  return (
    <div className="space-y-4">
      {/* Action row parity with the lead report header (UAT 2026-05-22,
          done-condition 10): head is read-only, so the lead Submit slot is
          replaced by export / presentation actions. Same toolbar shape,
          scope + view-mode toggles share the row. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ScopeToggle
          value={scope}
          onChange={setScope}
          allowedScopes={["product", "lead"]}
        />
        <ViewModeToggle editHref={editHref} slidesHref={slidesHref} />
        <a
          href={presentHref}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
          aria-label="Open presentation"
        >
          Presentation
        </a>
        <a
          href={printHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
          aria-label="Export PDF"
        >
          Export PDF
        </a>
      </div>
      {mode === "slides" ? (
        <Suspense fallback={<SlideSkeleton />}>
          <HeadSlidesClient reportId={reportId} scope={reportScope} />
        </Suspense>
      ) : (
        // Split-view parity with the lead report: at xl the aggregated status
        // (left) sits beside a read-only slide preview (right). Both read the
        // shared weeklyReport.get query (React Query dedupes the fetch). Below
        // xl it stays single-column; ?mode=slides drives the standalone deck.
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] xl:items-start xl:gap-6">
          <div className="min-w-0">
            <Suspense fallback={<WeeklyReportSkeleton />}>
              <WeeklyReportPage
                reportId={reportId}
                authorId={authorId}
                scope={reportScope}
              />
            </Suspense>
          </div>
          <aside
            aria-label="Slide preview"
            className="hidden min-w-0 xl:sticky xl:top-4 xl:block"
          >
            <Suspense fallback={<SlideSkeleton />}>
              <HeadSlidesClient reportId={reportId} scope={reportScope} />
            </Suspense>
          </aside>
        </div>
      )}
    </div>
  );
}
