"use client";

import { ArrowLeft } from "lucide-react";
import { Suspense, use } from "react";

import { AgentReviewComingSoon } from "../../../../components/report-shell/agent-review-coming-soon";
import { WeeklyReportPage } from "../../../../components/weekly-report/weekly-report-page";
import { WeeklyReportSkeleton } from "../../../../components/weekly-report/weekly-report-skeleton";

/* ------------------------------------------------------------------ */
/*  Published Report Viewer — Client Component (Phase 21)             */
/*  Thin wrapper around WeeklyReportPage that scopes the query to the */
/*  dynamic [reportId] route param.                                   */
/*                                                                    */
/*  unify-top-action-toolbars D4 / task 2.0: the wrapper no longer    */
/*  renders its own <h1>Status Report</h1> + Report-ID context block. */
/*  WeeklyReportPage already renders that title ("Status Report ·     */
/*  Live · N/N"), so the wrapper used to DOUBLE it on screen. The     */
/*  viewer actions pass through WeeklyReportPage's headerActions slot  */
/*  so the page owns exactly one header row and keeps its own period   */
/*  ReportToolbar (week + date range) below it. The `toolbar` slot is  */
/*  left unset so the page's default period-context bar still renders. */
/* ------------------------------------------------------------------ */

interface Props {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ authorId?: string }>;
}

export default function PublishedReportPage({ params, searchParams }: Props) {
  const { reportId } = use(params);
  const { authorId } = use(searchParams);

  const archiveHref = "/reports?tab=published";

  // fix-report-surface-integrity W2 (task 3.3, report-toolbar-parity): the
  // standalone Present and browser-Print links are gone. Presentation now
  // lives inline via `?mode=slides`; the single labeled Export-PDF (the real
  // async pdfExport.request job) is rendered by WeeklyReportPage's trailing
  // group for head/admin/viewer — so the viewer keeps its PDF affordance
  // without the now-broken `/print` deep link (the print route 307-redirects
  // humans away). A lead instead sees the inert ComingSoon control (lead is
  // FORBIDDEN from pdfExport).
  const viewerActions = (
    <>
      <a
        href={archiveHref}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
        aria-label="Back to Archive"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back to Archive</span>
      </a>
      <AgentReviewComingSoon />
    </>
  );

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <WeeklyReportPage
            reportId={reportId}
            authorId={authorId}
            headerActions={viewerActions}
          />
        </Suspense>
      </div>
    </main>
  );
}
