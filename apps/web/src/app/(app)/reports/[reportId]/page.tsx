type Props = {
  params: Promise<{ reportId: string }>;
};

export default async function PublishedReportPage({ params }: Props) {
  const { reportId } = await params;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
              Published Report
            </h1>
            <a
              href="/head/dashboard"
              className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
            >
              Back to Dashboard
            </a>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Report {reportId} — Published report viewer will be implemented in Wave 6.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
