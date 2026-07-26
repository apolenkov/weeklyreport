"use client";

import type { ReportPeriod } from "../../report-sections";
import type {
  PeriodListboxNav,
  PeriodNavigatorSelection,
} from "../model/use-period-navigator";
import { usePeriodNavigator } from "../model/use-period-navigator";
import {
  ArchivedBadge,
  periodLabel,
  PeriodListboxPanel,
  SubmittedBadge,
} from "./period-listbox-panel";
import { ChevronLeft, ChevronRight } from "./period-navigator-icons";

const PERIOD_SELECT_WIDTH_CH = 24;

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
  listbox,
  selectedPeriod,
  selectedSubmitted,
}: {
  readonly listbox: PeriodListboxNav;
  readonly selectedPeriod: ReportPeriod | undefined;
  readonly selectedSubmitted: boolean;
}) {
  const {
    open,
    activeIdx,
    optionIdPrefix,
    triggerRef,
    listboxId,
    toggleOpen,
    handleTriggerKeyDown,
  } = listbox;
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
        aria-activedescendant={
          open ? `${optionIdPrefix}${activeIdx}` : undefined
        }
        className="flex h-[var(--toolbar-control-h)] w-full cursor-pointer items-center gap-1.5 truncate rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2 pr-7 text-left text-[13px] font-semibold text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,117,74,0.16)]"
        onClick={toggleOpen}
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
  );
}

export function PeriodNavigator({
  periods,
  currentPeriodId,
  urlBuilder,
  showLeadSubmissionMarkers = false,
  leadSubmittedAt = null,
}: PeriodNavigatorProps) {
  // Per-lead marker is only known for the displayed period (one submittedAt,
  // not whole history). Shows when the lead surface opted in and is submitted.
  const selectedSubmitted =
    showLeadSubmissionMarkers && leadSubmittedAt != null;
  const { selection, listbox } = usePeriodNavigator({
    periods,
    currentPeriodId,
    urlBuilder,
    selectedSubmitted,
  });

  return (
    <div
      className="flex min-w-0 items-center gap-1.5"
      onTouchStart={listbox.handleTouchStart}
      onTouchEnd={listbox.handleTouchEnd}
      role="group"
      aria-label="Period navigation (swipe left/right or use arrows)"
    >
      <PeriodNavArrowButton
        direction="prev"
        onClick={selection.goPrev}
        disabled={!selection.hasPrev}
        title="Previous period"
      />

      <PeriodSelectTrigger
        listbox={listbox}
        selectedPeriod={selection.selectedPeriod}
        selectedSubmitted={selectedSubmitted}
      />

      <PeriodNavArrowButton
        direction="next"
        onClick={selection.goNext}
        disabled={!selection.hasNext}
        title={selection.hasNext ? "Next period" : "Latest period"}
      />

      <PeriodOptionsPanel listbox={listbox} selection={selection} />
    </div>
  );
}

// Portaled listbox panel; rendered only while open and after the trigger rect
// has been measured (SSR has no document to portal into).
function PeriodOptionsPanel({
  listbox,
  selection,
}: {
  readonly listbox: PeriodListboxNav;
  readonly selection: PeriodNavigatorSelection;
}) {
  if (!listbox.open || !listbox.panelPos || typeof document === "undefined") {
    return null;
  }
  return (
    <PeriodListboxPanel
      options={selection.options}
      selectedId={selection.selectedPeriod?.id}
      activeIdx={listbox.activeIdx}
      pos={listbox.panelPos}
      panelRef={listbox.panelRef}
      listboxId={listbox.listboxId}
      optionIdPrefix={listbox.optionIdPrefix}
      onHover={listbox.setActiveIdx}
      onSelect={listbox.selectOption}
      onKeyDown={listbox.handleListKeyDown}
    />
  );
}
