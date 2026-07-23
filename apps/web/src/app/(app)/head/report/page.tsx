import { WeeklyReportPage } from "../../../../features/report-pages";

interface Props {
  searchParams: Promise<{ authorId?: string }>;
}

/**
 * Bare `/head/report` route. The addressed view `/head/report/[reportId]`
 * is canonical. This page is preserved for back-compat:
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
        <WeeklyReportPage authorId={authorId} redirectToCanonical />
      </div>
    </main>
  );
}
