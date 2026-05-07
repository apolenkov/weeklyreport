import { Suspense } from 'react';

import { WeeklyReportPage } from '../../../../components/weekly-report/weekly-report-page';
import { WeeklyReportSkeleton } from '../../../../components/weekly-report/weekly-report-skeleton';

type Props = {
  searchParams: Promise<{ authorId?: string; period?: string }>;
};

/**
 * Bare `/head/report` route. Phase 35-07 introduces the addressed view
 * `/head/report/[reportId]` (UX-15). This page is preserved for back-compat:
 * legacy bookmarks / email links still land here, and the page redirects
 * (client-side `router.replace`) to the canonical URL once the active
 * reportId is known. The redirect is suppressed when `?period=...` is
 * present so old read-only links keep working unchanged.
 */
export default async function HeadReportPage({ searchParams }: Props) {
  const { authorId, period } = await searchParams;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <WeeklyReportPage
            period={period}
            authorId={authorId}
            redirectToCanonical
          />
        </Suspense>
      </div>
    </main>
  );
}
