'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, type TouchEvent as ReactTouchEvent } from 'react';

import type { ReportPeriod } from '../dashboard/mock-data';

// Threshold for treating a horizontal touch drag as a swipe. 50px matches the
// iOS "swipe to navigate" feel — enough to ignore accidental finger drift on
// the dropdown but small enough to feel responsive.
const SWIPE_THRESHOLD_PX = 50;

type PeriodNavigatorProps = {
  readonly periods: ReportPeriod[];
  readonly basePath?: string;
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

export function HeadPeriodNavigator({ periods, basePath = '/head/report' }: PeriodNavigatorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPeriodParam = searchParams.get('period');

  // 35-07: read the path-segment reportId so the dropdown reflects the
  // addressed week even before the period dropdown carries query state.
  const pathReportId = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/head\/report\/([^/]+)$/);
    return match ? match[1] : null;
  }, [pathname]);

  const currentIndex = useMemo(() => {
    const id = pathReportId ?? currentPeriodParam;
    if (!id) return 0;
    const idx = periods.findIndex((p) => p.id === id);
    return idx >= 0 ? idx : 0;
  }, [pathReportId, currentPeriodParam, periods]);

  const selectedPeriod = periods[currentIndex];
  const hasPrev = currentIndex < periods.length - 1;
  const hasNext = currentIndex > 0;

  const navigateTo = useCallback(
    (periodId: string) => {
      // 35-07: every period addressed via `/head/report/<reportId>`. Both
      // current and past weeks now have shareable / bookmarkable URLs;
      // `router.push` (not replace) so the browser back button walks the
      // history of viewed weeks. The previous current/past split routed
      // past periods through `/reports/[reportId]` — that surface still
      // exists for the published-archive flow, but in-page navigation
      // sticks with the head-report URL family.
      router.push(`${basePath}/${periodId}`);
    },
    [router, basePath],
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

  // Phase 33-04: swipe gesture on the navigator strip. Swipe-left = next week,
  // swipe-right = previous week. Mobile users (and trackpad users on macOS)
  // expected this to "just work" in the published report viewer / weekly
  // report; the chevrons are now backed by the same gesture.
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
      className="flex items-center gap-2"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="group"
      aria-label="Period navigation (swipe left/right or use arrows)"
    >
      <button
        type="button"
        className="flex min-h-[var(--touch-target-min)] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
        onClick={handlePrev}
        disabled={!hasPrev}
        title="Previous week"
        aria-label="Previous week"
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
          </option>
        ))}
      </select>

      <button
        type="button"
        className="flex min-h-[var(--touch-target-min)] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
        onClick={handleNext}
        disabled={!hasNext}
        title={hasNext ? 'Next week' : 'Latest week'}
        aria-label="Next week"
      >
        <ChevronRight />
      </button>
    </div>
  );
}
