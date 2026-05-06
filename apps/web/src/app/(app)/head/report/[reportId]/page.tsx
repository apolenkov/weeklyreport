import { WeeklyReportPage } from '../../../../../components/weekly-report/weekly-report-page';

type Props = {
  params: Promise<{ reportId: string }>;
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
export default async function HeadReportByIdPage({ params }: Props) {
  const { reportId } = await params;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <WeeklyReportPage reportId={reportId} />
      </div>
    </main>
  );
}
