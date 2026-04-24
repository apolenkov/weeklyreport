import { Suspense } from 'react';

import { LeadForm } from '../../../../components/lead/lead-form';

type Props = {
  searchParams: Promise<{ period?: string }>;
};

export default async function LeadReportPage({ searchParams }: Props) {
  const { period } = await searchParams;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8" style={{ paddingBottom: '88px' }}>
        <Suspense
          fallback={
            <div className="space-y-6">
              <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--color-skeleton)]" />
              <div className="h-16 w-full animate-pulse rounded-2xl bg-[var(--color-skeleton)]" />
              <div className="h-64 w-full animate-pulse rounded-xl bg-[var(--color-skeleton)]" />
            </div>
          }
        >
          <LeadForm period={period} />
        </Suspense>
      </div>
    </main>
  );
}
