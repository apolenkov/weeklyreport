import Link from "next/link";
import { Suspense } from "react";

import { HeadPresentClient } from "../../../../../components/head/head-present-client";
import { WeeklyReportSkeleton } from "../../../../../components/weekly-report/weekly-report-skeleton";

interface Props {
  params: Promise<{ reportId: string }>;
}

export default async function PublishedReportPresentPage({ params }: Props) {
  const { reportId } = await params;

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
      data-testid="published-present-page"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              Status Presentation
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Published report view
            </p>
          </div>
          <Link
            href={`/reports/${reportId}`}
            className="rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            Back to report
          </Link>
        </header>

        <Suspense fallback={<WeeklyReportSkeleton />}>
          <HeadPresentClient
            reportId={reportId}
            exitHref={`/reports/${reportId}`}
          />
        </Suspense>
      </div>
    </main>
  );
}
