'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { LeadHistoryList } from '../../../../components/lead/lead-history-list';
import { LeadHistorySkeleton } from '../../../../components/lead/lead-history-skeleton';
import { mapHistoryEntries } from '../../../../lib/mappers';
import { useTRPC } from '../../../../lib/trpc-context';

/**
 * Per CONTEXT.md migration order, this is migration 1/5 -- smallest container
 * first to validate the provider+mapper+skeleton+toast pattern. Children
 * (`LeadHistoryList`) are untouched per ARCHITECTURE.md container/presentation
 * split: only the type import is rewired to the mappers barrel.
 */
export default function LeadHistoryPage() {
  const trpc = useTRPC();
  const { data, isLoading, isError, error } = useQuery(
    trpc.reports.myHistory.queryOptions(),
  );

  useEffect(() => {
    if (isError) {
      toast.error(error?.message ?? 'Failed to load report history.');
    }
  }, [isError, error]);

  const entries = data ? mapHistoryEntries(data) : [];

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
            <LeadHistoryList entries={entries} />
          )}
        </div>
      </div>
    </main>
  );
}
