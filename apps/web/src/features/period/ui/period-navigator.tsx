"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import { useCallback, useId, useMemo } from "react";

import type { ReportPeriod } from "../../report-sections";
import { usePeriodListboxNav } from "../model/use-period-listbox-nav";
import {
  ArchivedBadge,
  periodLabel,
  PeriodListboxPanel,
  SubmittedBadge,
} from "./period-listbox-panel";
import { ChevronLeft, ChevronRight } from "./period-navigator-icons";

// Lead-form addressable URL base. Period nav emits path-segment
// URLs (`/lead/report/<reportId>`) so each week is bookmarkable.
const LEAD_REPORT_BASE = "/lead/report";
const PERIOD_SELECT_WIDTH_CH = 24;

// The only routes that address a period as the trailing path segment.
const ADDRESSED_PERIOD_PATH = /^\/(?:lead|head)\/report\/([^/]+)$/;

interface PeriodNavigatorProps {
  readonly periods: ReportPeriod[];
  /**
   * Addressed period id. When supplied, this takes precedence over the
   * pathname regex used to infer the current period.
   */
  readonly currentPeriodId?: string;
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

const PERIOD_NAV_ARROW_BUTTON_CLASS =
  "inline-flex h-[var(--toolbar-control-h)] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35";

// options expose structured fields (not a flattened label string) so
// archived/current markers render as badges inside the custom listbox.
function toPeriodOptions(
  periods: readonly ReportPeriod[],
  selectedSubmitted: boolean,
  selectedPeriodId: string | undefined,
) {
  return periods.map((p) => ({
    id: p.id,
    dateRange: p.dateRange,
    isCurrent: p.isCurrent,
    archived: p.archived ?? false,
    submitted: selectedSubmitted && p.id === selectedPeriodId,
  }));
}

function PeriodNavArrowButton({
  direction,
  onClick,
  disabled,
  title,
}: {
  readonly direction: "prev" | "next";
  readonly onClick: () => void;
  readonly disabled: boolean;
  readonly title: string;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      className={PERIOD_NAV_ARROW_BUTTON_CLASS}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={isPrev ? "Previous period" : "Next period"}
    >
      {isPrev && <ChevronLeft />}
      <span className="text-xs font-medium xl:hidden">
        {isPrev ? "Previous" : "Next"}
      </span>
      {!isPrev && <ChevronRight />}
    </button>
  );
}

function PeriodSelectTrigger({
  triggerRef,
  open,
  listboxId,
  activeDescendantId,
  selectedPeriod,
  selectedSubmitted,
  onClick,
  onKeyDown,
}: {
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
  readonly open: boolean;
  readonly listboxId: string;
  readonly activeDescendantId: string | undefined;
  readonly selectedPeriod: ReportPeriod | undefined;
  readonly selectedSubmitted: boolean;
  readonly onClick: () => void;
  readonly onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
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
        aria-activedescendant={activeDescendantId}
        className="flex h-[var(--toolbar-control-h)] w-full cursor-pointer items-center gap-1.5 truncate rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2 pr-7 text-left text-[13px] font-semibold text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,117,74,0.16)]"
        onClick={onClick}
        onKeyDown={onKeyDown}
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
  );
}

export function PeriodNavigator({
  periods,
  currentPeriodId,
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

  // Preserve path-based inference for lead and head callers that do not pass
  // the addressed period id explicitly.
  const pathReportId = useMemo(() => {
    if (currentPeriodId !== undefined || !pathname) return null;
    const match = ADDRESSED_PERIOD_PATH.exec(pathname);
    return match ? match[1] : null;
  }, [currentPeriodId, pathname]);

  const currentIndex = useMemo(() => {
    const resolvedPeriodId = currentPeriodId ?? pathReportId;
    if (!resolvedPeriodId) return 0; // default to first (current) period
    const index = periods.findIndex((period) => period.id === resolvedPeriodId);
    return index !== -1 ? index : 0;
  }, [currentPeriodId, pathReportId, periods]);

  const selectedPeriod = periods.at(currentIndex);
  const hasPrev = currentIndex < periods.length - 1;
  const hasNext = currentIndex > 0;
  // Per-lead marker is only known for the displayed period (one submittedAt,
  // not whole history). Shows when the lead surface opted in and is submitted.
  const selectedSubmitted =
    showLeadSubmissionMarkers && leadSubmittedAt != null;
  const periodOptions = useMemo(
    () => toPeriodOptions(periods, selectedSubmitted, selectedPeriod?.id),
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

  const {
    listboxId,
    optionIdPrefix,
    open,
    toggleOpen,
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
      <PeriodNavArrowButton
        direction="prev"
        onClick={handlePrev}
        disabled={!hasPrev}
        title="Previous period"
      />

      <PeriodSelectTrigger
        triggerRef={triggerRef}
        open={open}
        listboxId={listboxId}
        activeDescendantId={open ? `${optionIdPrefix}${activeIdx}` : undefined}
        selectedPeriod={selectedPeriod}
        selectedSubmitted={selectedSubmitted}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      />

      <PeriodNavArrowButton
        direction="next"
        onClick={handleNext}
        disabled={!hasNext}
        title={hasNext ? "Next period" : "Latest period"}
      />

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
