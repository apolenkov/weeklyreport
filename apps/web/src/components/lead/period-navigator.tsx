'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import type { ReportPeriod } from './mock-data';

type PeriodNavigatorProps = {
  readonly periods: ReportPeriod[];
};

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function PeriodNavigator({ periods }: PeriodNavigatorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPeriodParam = searchParams.get('period');

  const currentIndex = useMemo(() => {
    if (!currentPeriodParam) return 0; // default to first (current) period
    const idx = periods.findIndex((p) => p.id === currentPeriodParam);
    return idx >= 0 ? idx : 0;
  }, [currentPeriodParam, periods]);

  const selectedPeriod = periods[currentIndex];
  const hasPrev = currentIndex < periods.length - 1;
  const hasNext = currentIndex > 0;

  const navigateTo = useCallback(
    (periodId: string) => {
      const period = periods.find((p) => p.id === periodId);
      if (period?.isCurrent) {
        router.push('/lead/report');
      } else {
        router.push(`/lead/report?period=${periodId}`);
      }
    },
    [router, periods],
  );

  function handlePrev() {
    if (hasPrev) {
      navigateTo(periods[currentIndex + 1]!.id);
    }
  }

  function handleNext() {
    if (hasNext) {
      navigateTo(periods[currentIndex - 1]!.id);
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    navigateTo(e.target.value);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
        onClick={handlePrev}
        disabled={!hasPrev}
        title="Previous period"
        aria-label="Previous period"
      >
        <ChevronLeft />
      </button>

      <select
        aria-label="Select reporting period"
        className="cursor-pointer appearance-none rounded-lg border border-[var(--color-muted)] bg-[var(--color-background)] px-2.5 py-1.5 pr-7 font-[family-name:var(--font-sans)] text-[13px] font-medium focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
        value={selectedPeriod?.id ?? ''}
        onChange={handleSelect}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
        }}
      >
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.weekLabel} &middot; {p.dateRange}
            {p.isCurrent ? ' (current)' : ''}
            {p.isSubmitted ? ' \u2713' : ''}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
        onClick={handleNext}
        disabled={!hasNext}
        title={hasNext ? 'Next period' : 'Latest period'}
        aria-label="Next period"
      >
        <ChevronRight />
      </button>
    </div>
  );
}
