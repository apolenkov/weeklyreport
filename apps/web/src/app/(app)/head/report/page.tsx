import { Suspense } from "react";

import { WeeklyReportPage } from "../../../../features/report-sections/ui/weekly-report-page";
import { WeeklyReportSkeleton } from "../../../../features/report-sections/ui/weekly-report-skeleton";

interface Props {
  searchParams: Promise<{ authorId?: string }>;
}

/**
 * Bare `/head/report` route. Phase 35-07 introduces the addressed view
 * `/head/report/[reportId]` (UX-15). This page is preserved for back-compat:
 * legacy bookmarks / email links still land here, and the page redirects
 * (client-side `router.replace`) to the canonical URL once the active
 * reportId is known. The legacy `?period=<week>` query is no longer a
 * special case — viewing a past week goes through the addressed URL plus
 * the history dropdown — so it is ignored and the redirect still fires.
 */
export default async function HeadReportPage({ searchParams }: Props) {
  const { authorId } = await searchParams;

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <WeeklyReportPage authorId={authorId} redirectToCanonical />
        </Suspense>
      </div>
    </main>
  );
}
