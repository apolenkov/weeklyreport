"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useId, useMemo } from "react";

import type { ReportPeriod } from "../../report-sections/model/mock-data";
import { usePeriodListboxNav } from "../model/use-period-listbox-nav";
import {
  ArchivedBadge,
  periodLabel,
  PeriodListboxPanel,
  SubmittedBadge,
} from "./period-listbox-panel";

// Lead-form addressable URL base. Period nav emits path-segment
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
  /**
   * Opt-in per-lead submitted marker. Only the lead surface passes this;
   * head and viewer navigators omit it and therefore never show the marker.
   */
  readonly showLeadSubmissionMarkers?: boolean;
  /**
   * The current lead's `ReportSection.submittedAt` for the displayed
   * period. Sourced ONLY from the lead's own section — never the head shell's
   * fabricated `isSubmitted` flag. The marker shows on the selected period
   * when `showLeadSubmissionMarkers` is set and this value is non-null.
   */
  readonly leadSubmittedAt?: Date | string | null;
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
  "inline-flex h-[var(--toolbar-control-h)] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35";

export function PeriodNavigator({
  periods,
  urlBuilder,
  showLeadSubmissionMarkers = false,
  leadSubmittedAt = null,
}: PeriodNavigatorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // per-instance scoped listbox/option ids, so two navigators on one page
  // never collide on the DOM ids that aria-controls / aria-activedescendant
  // reference (see usePeriodListboxNav).
  const instanceId = useId();

  // The dropdown reflects the path-segment reportId when the page is
  // rendered under `/lead/report/[reportId]`. This navigator is also
  // rendered on `/head/report/[reportId]` (via HeadReportShell with a
  // urlBuilder), so the regex must match the head base too — otherwise
  // currentIndex defaults to 0 and the trigger shows the latest published
  // period instead of the addressed week.
  const pathReportId = useMemo(() => {
    if (!pathname) return null;
    const match = /^\/(?:lead|head)\/report\/([^/]+)$/.exec(pathname);
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
  // the submitted marker is per-lead and only known for the displayed
  // period (the navigator carries one submittedAt value, never the whole
  // history). It shows on the selected period iff the lead surface opted in
  // and the lead's own section is submitted.
  const selectedSubmitted =
    showLeadSubmissionMarkers && leadSubmittedAt != null;
  // options expose structured fields (not a flattened label string) so
  // archived/current markers render as badges inside the custom listbox.
  const periodOptions = useMemo(
    () =>
      periods.map((p) => ({
        id: p.id,
        dateRange: p.dateRange,
        isCurrent: p.isCurrent,
        archived: p.archived ?? false,
        submitted: selectedSubmitted && p.id === selectedPeriod?.id,
      })),
    [periods, selectedSubmitted, selectedPeriod?.id],
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

  // ---- Custom listbox + swipe gesture live in a hook so this component
  // stays focused on rendering. ----
  const {
    listboxId,
    optionIdPrefix,
    open,
    setOpen,
    activeIdx,
    setActiveIdx,
    triggerRef,
    panelRef,
    panelPos,
    selectOption,
    handleTriggerKeyDown,
    handleListKeyDown,
    handleTouchStart,
    handleTouchEnd,
  } = usePeriodListboxNav({
    instanceId,
    currentIndex,
    periodOptionIds: useMemo(
      () => periodOptions.map((o) => o.id),
      [periodOptions],
    ),
    selectedPeriodId: selectedPeriod?.id,
    navigateTo,
    onPrev: handlePrev,
    onNext: handleNext,
  });

  return (
    <div
      className="flex min-w-0 items-center gap-1.5"
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
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-label="Select reporting period"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open ? `${optionIdPrefix}${activeIdx}` : undefined
          }
          className="flex h-[var(--toolbar-control-h)] w-full cursor-pointer items-center gap-1.5 truncate rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2 pr-7 text-left text-[13px] font-semibold text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,117,74,0.16)]"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="truncate">
            {selectedPeriod ? periodLabel(selectedPeriod) : ""}
          </span>
          {selectedSubmitted && <SubmittedBadge />}
          {selectedPeriod?.archived && <ArchivedBadge />}
        </button>
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

      {open && panelPos && typeof document !== "undefined" && (
        <PeriodListboxPanel
          options={periodOptions}
          selectedId={selectedPeriod?.id}
          activeIdx={activeIdx}
          pos={panelPos}
          panelRef={panelRef}
          listboxId={listboxId}
          optionIdPrefix={optionIdPrefix}
          onHover={setActiveIdx}
          onSelect={selectOption}
          onKeyDown={handleListKeyDown}
        />
      )}
    </div>
  );
}
