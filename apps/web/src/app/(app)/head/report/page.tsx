import { WeeklyReportPage } from '../../../../components/weekly-report/weekly-report-page';

type Props = {
  searchParams: Promise<{ period?: string }>;
};

export default async function HeadReportPage({ searchParams }: Props) {
  const { period } = await searchParams;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <WeeklyReportPage period={period} />
      </div>
    </main>
  );
}
