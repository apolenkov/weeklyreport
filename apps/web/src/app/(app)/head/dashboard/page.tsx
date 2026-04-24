export default function DashboardPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
            Dashboard
          </h1>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Submissions</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-foreground)]">—/—</p>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Deadline</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-foreground)]">—</p>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Escalations</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-foreground)]">—</p>
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Dashboard with KPIs, Lead Reports, Blocked &amp; At Risk, and Archive will be
              implemented in Wave 4.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
