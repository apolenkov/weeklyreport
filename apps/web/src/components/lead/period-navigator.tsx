'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, type TouchEvent as ReactTouchEvent } from 'react';

import type { ReportPeriod } from './mock-data';

const SWIPE_THRESHOLD_PX = 50;

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

// Calendar icon anchors the period control group so it doesn't read as a
// duplicate of the version chevrons sitting a few centimetres to the right.
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function PeriodNavigator({ periods }: PeriodNavigatorProps) {
  const router = useRouter();
  const pathname = usePathname();
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
      const params = new URLSearchParams(searchParams.toString());
      if (period?.isCurrent) {
        params.delete('period');
      } else {
        params.set('period', periodId);
      }
      const qs = params.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      // Use replace so back-button history doesn't accumulate period selections.
      router.replace(target);
    },
    [router, pathname, searchParams, periods],
  );

  function handlePrev() {
    const prev = periods[currentIndex + 1];
    if (hasPrev && prev) navigateTo(prev.id);
  }

  function handleNext() {
    const next = periods[currentIndex - 1];
    if (hasNext && next) navigateTo(next.id);
  }

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    navigateTo(e.target.value);
  }

  // Phase 33-04: swipe gesture mirrors HeadPeriodNavigator. Left = next week,
  // right = previous week.
  const touchStartXRef = useRef<number | null>(null);
  function handleTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    touchStartXRef.current = t ? t.clientX : null;
  }
  function handleTouchEnd(e: ReactTouchEvent<HTMLDivElement>) {
    const start = touchStartXRef.current;
    touchStartXRef.current = null;
    if (start === null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const deltaX = t.clientX - start;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    if (deltaX < 0) handleNext();
    else handlePrev();
  }

  return (
    <div
      className="flex min-w-0 items-center gap-2"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="group"
      aria-label="Period navigation (swipe left/right or use arrows)"
    >
      <span
        className="flex items-center gap-1 text-xs font-medium text-[var(--color-muted-foreground)]"
        aria-hidden="true"
      >
        <CalendarIcon />
        Week
      </span>

      <button
        type="button"
        className="flex min-h-[var(--touch-target-min)] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
        onClick={handlePrev}
        disabled={!hasPrev}
        title="Previous period"
        aria-label="Previous period"
      >
        <ChevronLeft />
      </button>

      <select
        aria-label="Select reporting period"
        className="min-w-0 flex-1 cursor-pointer appearance-none truncate rounded-lg border border-[var(--color-muted)] bg-[var(--color-background)] px-2.5 py-1.5 pr-7 font-[family-name:var(--font-sans)] text-[13px] font-medium focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
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
        className="flex min-h-[var(--touch-target-min)] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
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
