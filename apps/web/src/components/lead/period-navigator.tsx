"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useMemo,
  useRef,
} from "react";

import type { ReportPeriod } from "./mock-data";

const SWIPE_THRESHOLD_PX = 50;
// 35-07: lead-form addressable URL base. Period nav now emits path-segment
// URLs (`/lead/report/<reportId>`) so each week is bookmarkable.
const LEAD_REPORT_BASE = "/lead/report";
const PERIOD_SELECT_WIDTH_CH = 24;

interface PeriodNavigatorProps {
  readonly periods: ReportPeriod[];
  /**
   * Optional URL builder for navigation. When provided, replaces the default
   * lead-specific `/lead/report/<periodId>` path construction so the navigator
   * can be reused by other roles via a custom addressed-path scheme.
   * Receives the target periodId; must return the full href to push.
   */
  readonly urlBuilder?: (periodId: string) => string;
}

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export const PERIOD_NAV_ARROW_BUTTON_CLASS =
  "inline-flex min-h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35";

export function PeriodNavigator({ periods, urlBuilder }: PeriodNavigatorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 35-07: the dropdown reflects the path-segment reportId when the page is
  // rendered under `/lead/report/[reportId]`.
  const pathReportId = useMemo(() => {
    if (!pathname) return null;
    const match = /^\/lead\/report\/([^/]+)$/.exec(pathname);
    return match ? match[1] : null;
  }, [pathname]);

  const currentIndex = useMemo(() => {
    if (!pathReportId) return 0; // default to first (current) period
    const idx = periods.findIndex((p) => p.id === pathReportId);
    return idx !== -1 ? idx : 0;
  }, [pathReportId, periods]);

  const selectedPeriod = periods.at(currentIndex);
  const hasPrev = currentIndex < periods.length - 1;
  const hasNext = currentIndex > 0;
  const periodOptions = useMemo(
    () =>
      periods.map((p) => ({
        id: p.id,
        label: p.isCurrent ? `${p.dateRange} (Current)` : p.dateRange,
      })),
    [periods],
  );

  const navigateTo = useCallback(
    (periodId: string) => {
      if (urlBuilder) {
        router.push(urlBuilder(periodId));
        return;
      }
      // Default: lead path-segment URLs — bookmarkable, back-button-friendly.
      const next = new URLSearchParams(searchParams.toString());
      const query = next.toString();
      const suffix = query ? `?${query}` : "";
      router.push(`${LEAD_REPORT_BASE}/${periodId}${suffix}`);
    },
    [router, searchParams, urlBuilder],
  );

  function handlePrev() {
    const prev = periods.at(currentIndex + 1);
    if (hasPrev && prev) navigateTo(prev.id);
  }

  function handleNext() {
    const next = periods.at(currentIndex - 1);
    if (hasNext && next) navigateTo(next.id);
  }

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    navigateTo(e.target.value);
  }

  // Phase 33-04: swipe gesture mirrors HeadPeriodNavigator. Left = next week,
  // right = previous week.
  const touchStartXRef = useRef<number | null>(null);
  function handleTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    const t = Array.from(e.touches).at(0);
    touchStartXRef.current = t ? t.clientX : null;
  }
  function handleTouchEnd(e: ReactTouchEvent<HTMLDivElement>) {
    const start = touchStartXRef.current;
    touchStartXRef.current = null;
    if (start === null) return;
    const t = Array.from(e.changedTouches).at(0);
    if (!t) return;
    const deltaX = t.clientX - start;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    if (deltaX < 0) handleNext();
    else handlePrev();
  }

  return (
    <div
      className="flex min-w-0 items-center gap-3 px-3 py-2"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="group"
      aria-label="Period navigation (swipe left/right or use arrows)"
    >
      <button
        type="button"
        className={PERIOD_NAV_ARROW_BUTTON_CLASS}
        onClick={handlePrev}
        disabled={!hasPrev}
        title="Previous period"
        aria-label="Previous period"
      >
        <ChevronLeft />
        <span className="text-xs font-medium xl:hidden">Previous</span>
      </button>

      <div
        className="relative max-w-full flex-none"
        style={{ width: `${PERIOD_SELECT_WIDTH_CH}ch` }}
      >
        <select
          aria-label="Select reporting period"
          className="min-h-8 w-full cursor-pointer appearance-none rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2 pr-7 text-[13px] font-semibold text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,117,74,0.16)]"
          value={selectedPeriod?.id ?? ""}
          onChange={handleSelect}
        >
          {periodOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]">
          <ChevronRight />
        </span>
      </div>

      <button
        type="button"
        className={PERIOD_NAV_ARROW_BUTTON_CLASS}
        onClick={handleNext}
        disabled={!hasNext}
        title={hasNext ? "Next period" : "Latest period"}
        aria-label="Next period"
      >
        <span className="text-xs font-medium xl:hidden">Next</span>
        <ChevronRight />
      </button>
    </div>
  );
}
