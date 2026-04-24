type Props = {
  searchParams: Promise<{ period?: string }>;
};

export default async function LeadReportPage({ searchParams }: Props) {
  const { period } = await searchParams;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
              My Report
            </h1>
            {period && (
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                Period: {period}
              </p>
            )}
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Lead Form will be implemented in Wave 3. SDLC pipeline, period navigator,
              Fill From, version history, and all form sections.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
