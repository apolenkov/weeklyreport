type Props = {
  searchParams: Promise<{ period?: string }>;
};

export default async function WeeklyReportPage({ searchParams }: Props) {
  const { period } = await searchParams;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
              Weekly Report
            </h1>
            {period && (
              <span className="rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-3 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
                Period: {period}
              </span>
            )}
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Weekly Report with portfolio overview, per-lead accordions, Publish &amp; Lock,
              and Export PDF will be implemented in Wave 4.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
