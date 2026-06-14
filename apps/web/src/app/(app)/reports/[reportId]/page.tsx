"use client";

import { ArrowLeft, FileDown, Presentation } from "lucide-react";
import { Suspense, use } from "react";

import { AgentReviewComingSoon } from "../../../../components/report-shell/agent-review-coming-soon";
import { ReportActionsPill } from "../../../../components/report-shell/report-toolbar";
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
/*  viewer actions sit in the shared ReportActionsPill rendered ABOVE  */
/*  WeeklyReportPage — exactly like the head report shell, which mounts */
/*  the pill outside the page and lets the page keep its own period    */
/*  ReportToolbar (week + date range). The `toolbar` slot is left      */
/*  unset so the page's default period-context bar still renders; that  */
/*  bar is the only place the report states WHICH WEEK it covers.      */
/*  (review-finding fix: the earlier slot-only wiring dropped it.)     */
/* ------------------------------------------------------------------ */

interface Props {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ authorId?: string }>;
}

export default function PublishedReportPage({ params, searchParams }: Props) {
  const { reportId } = use(params);
  const { authorId } = use(searchParams);

  const archiveHref = "/reports?tab=published";
  const presentHref = `/reports/${reportId}/present`;
  const printHref = `/print/${reportId}`;

  // unify-top-action-toolbars D4: viewer grouping — left = "Back to Archive"
  // (navigate away), right = presentation / print / agent review (act on the
  // current report). All hrefs/aria/behavior preserved from the prior bare row.
  const viewerActions = (
    <ReportActionsPill
      leftGroup={
        <a
          href={archiveHref}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
          aria-label="Back to Archive"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Archive</span>
        </a>
      }
      rightGroup={
        <>
          <a
            href={presentHref}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
            aria-label="Open presentation"
          >
            <Presentation className="h-4 w-4" aria-hidden="true" />
            <span>Presentation</span>
          </a>
          <a
            href={printHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            title="Print report (browser print)"
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            <span>Print</span>
          </a>
          <AgentReviewComingSoon compact />
        </>
      }
    />
  );

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        {/* The AI period-summary surface was removed; the assembled report
            renders directly. The agent-review «coming soon» entry lives in the
            action pill / slide decks / report shells. The pill mounts ABOVE the
            page (like the head shell), so the page keeps its own period bar. */}
        {viewerActions}
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <WeeklyReportPage reportId={reportId} authorId={authorId} />
        </Suspense>
      </div>
    </main>
  );
}
