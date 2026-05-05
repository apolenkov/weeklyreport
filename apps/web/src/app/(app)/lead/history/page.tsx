'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { LeadHistoryList } from '../../../../components/lead/lead-history-list';
import { LeadHistorySidebar } from '../../../../components/lead/lead-history-sidebar';
import { LeadHistorySkeleton } from '../../../../components/lead/lead-history-skeleton';
import { mapHistoryEntries } from '../../../../lib/mappers';
import { useTRPC } from '../../../../lib/trpc-context';

/**
 * Per CONTEXT.md migration order, this is migration 1/5 -- smallest container
 * first to validate the provider+mapper+skeleton+toast pattern.
 *
 * Phase 22 (plan 22-03, INT-08): `reports.myHistory` is not cursor-paginated
 * at v5.0 (returns the full array). To keep the page responsive and the spec
 * truthful, we apply a client-side reveal: render the first
 * `HISTORY_INITIAL_VISIBLE` entries, then expand on demand. Server cursor
 * support is deferred to Phase 23+.
 */
const HISTORY_INITIAL_VISIBLE = 10;

export default function LeadHistoryPage() {
  const trpc = useTRPC();
  const { data, isLoading, isError, error } = useQuery(
    trpc.reports.myHistory.queryOptions(),
  );
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (isError) {
      toast.error(error?.message ?? 'Failed to load report history.');
    }
  }, [isError, error]);

  const entries = data ? mapHistoryEntries(data) : [];
  const visibleEntries = showAll ? entries : entries.slice(0, HISTORY_INITIAL_VISIBLE);
  const hasMore = entries.length > HISTORY_INITIAL_VISIBLE && !showAll;

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
                {isLoading ? 'Loading…' : `${entries.length} past submissions`}
              </p>
            </div>
          </div>

          {isLoading ? (
            <LeadHistorySkeleton />
          ) : (
            // HIST-2 (Phase 33-04): two-column shell — list on the left, the
            // Reporting Overview / Recent Pattern sidebar on the right. lg+
            // breakpoint mirrors the rest of the app's wide-screen grids; on
            // narrower viewports the sidebar drops below the list so nothing
            // is clipped.
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-6">
                <LeadHistoryList entries={visibleEntries} />
                {hasMore && (
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
                      onClick={() => setShowAll(true)}
                      aria-label={`Show all ${entries.length} past submissions`}
                    >
                      Show all ({entries.length})
                    </button>
                  </div>
                )}
              </div>
              <LeadHistorySidebar entries={entries} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
