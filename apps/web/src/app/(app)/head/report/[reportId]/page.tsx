import { Suspense } from 'react';

import { WeeklyReportPage } from '../../../../../components/weekly-report/weekly-report-page';
import { WeeklyReportSkeleton } from '../../../../../components/weekly-report/weekly-report-skeleton';

type Props = {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ authorId?: string }>;
};

/**
 * Phase 35-07 (UX-15): addressed head report. The `[reportId]` segment pins
 * the assembled weekly view to a specific report. The bare `/head/report`
 * route redirects here once the active reportId is known.
 *
 * `weeklyReport.get` accepts the reportId directly, so the same component
 * that powers the bare route handles the addressed surface — only the
 * source of `reportId` changes.
 */
export default async function HeadReportByIdPage({ params, searchParams }: Props) {
  const { reportId } = await params;
  const { authorId } = await searchParams;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <WeeklyReportPage reportId={reportId} authorId={authorId} />
        </Suspense>
      </div>
    </main>
  );
}
