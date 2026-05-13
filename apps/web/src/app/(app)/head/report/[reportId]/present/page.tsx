import { Suspense } from "react";
import Link from "next/link";

import { WeeklyReportSkeleton } from "../../../../../../components/weekly-report/weekly-report-skeleton";
import { HeadPresentClient } from "../../../../../../components/head/head-present-client";

type Props = {
  params: Promise<{ reportId: string }>;
};

/**
 * UFB-NEW-A34 (Phase 60 early activation): head presentation surface.
 *
 * Full-screen slide deck for the consolidated weekly report.
 * Keyboard navigation: ← → or J/K to move between sections;
 * F to toggle fullscreen; Escape to exit fullscreen or return to report.
 */
export default async function HeadReportPresentPage({ params }: Props) {
  const { reportId } = await params;

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
      data-testid="head-present-page"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              Status Presentation
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Use ← → or J/K to navigate sections · F to toggle fullscreen
            </p>
          </div>
          <Link
            href={`/head/report/${reportId}`}
            className="rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            ← Back to report
          </Link>
        </header>

        <Suspense fallback={<WeeklyReportSkeleton />}>
          <HeadPresentClient reportId={reportId} />
        </Suspense>
      </div>
    </main>
  );
}
