"use client";

import { Suspense, use } from "react";

import { PeriodSummaryTabs } from "../../../../components/ai/period-summary-tabs";
import { WeeklyReportPage } from "../../../../components/weekly-report/weekly-report-page";
import { WeeklyReportSkeleton } from "../../../../components/weekly-report/weekly-report-skeleton";

/* ------------------------------------------------------------------ */
/*  Published Report Viewer — Client Component (Phase 21)             */
/*  Thin wrapper around WeeklyReportPage that scopes the query to the */
/*  dynamic [reportId] route param.                                   */
/* ------------------------------------------------------------------ */

type Props = {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ authorId?: string }>;
};

export default function PublishedReportPage({ params, searchParams }: Props) {
  const { reportId } = use(params);
  const { authorId } = use(searchParams);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
              Weekly Status Report
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Report ID: {reportId}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/head/dashboard"
              className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
              style={{ minHeight: "44px" }}
              aria-label="Back to Dashboard"
            >
              Back to Dashboard
            </a>
            <a
              href={`/print/${reportId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-green-accent,#00754A)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-green,#006241)]"
              style={{ minHeight: "44px" }}
              aria-label="Export PDF"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export PDF
            </a>
          </div>
        </div>

        {/* Phase 54 (UFB-055): «AI Summary» tab on /reports/<id> page.
            Default tab renders the existing assembled report; switching to
            «AI Summary» fires the mock period-summary tRPC query and
            renders the result with a clear (заглушка) badge until the
            org wires a real LLM provider. */}
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <PeriodSummaryTabs periodId={reportId}>
            <WeeklyReportPage reportId={reportId} authorId={authorId} />
          </PeriodSummaryTabs>
        </Suspense>
      </div>
    </main>
  );
}
