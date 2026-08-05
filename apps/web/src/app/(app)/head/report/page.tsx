import { WeeklyReportPage } from "../../../../features/report-pages";

interface Props {
  searchParams: Promise<{ authorId?: string }>;
}

// Back-compat bare route: client-replaces to /head/report/[reportId] once known.
export default async function HeadReportPage({ searchParams }: Props) {
  const { authorId } = await searchParams;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <WeeklyReportPage authorId={authorId} redirectToCanonical />
      </div>
    </main>
  );
}
