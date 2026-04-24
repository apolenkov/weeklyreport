import { LeadHistoryList } from '../../../../components/lead/lead-history-list';
import { MOCK_HISTORY } from '../../../../components/lead/mock-data';

export default function LeadHistoryPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
                My History
              </h1>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                {MOCK_HISTORY.length} past submissions
              </p>
            </div>
          </div>

          <LeadHistoryList entries={MOCK_HISTORY} />
        </div>
      </div>
    </main>
  );
}
