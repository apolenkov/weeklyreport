export default function LeadHistoryPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
            My History
          </h1>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Lead History with traffic light dots will be implemented in Wave 3.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
