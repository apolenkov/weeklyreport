"use client";

import type { ReportPeriod } from "../../report-sections";
import type {
  PeriodListboxNav,
  PeriodNavigatorSelection,
} from "../model/use-period-navigator";
import { periodLabel, usePeriodNavigator } from "../model/use-period-navigator";
import { ArchivedBadge, PeriodListboxPanel } from "./period-listbox-panel";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "./period-navigator-icons";

interface PeriodNavigatorProps {
  readonly periods: readonly ReportPeriod[];
  // Explicit addressed id takes precedence over pathname inference.
  readonly currentPeriodId?: string | undefined;
  // Allows other roles to supply an addressed-path scheme instead of the
  // lead-specific default URL.
  readonly urlBuilder?: ((periodId: string) => string) | undefined;
  // Only the lead surface opts into submitted markers.
  readonly showLeadSubmissionMarkers?: boolean | undefined;
  // Source this marker only from the lead's own section, never a head-shell
  // fabricated flag.
  readonly leadSubmittedAt?: Date | string | null | undefined;
}

const PERIOD_NAV_ARROW_BUTTON_CLASS =
  "inline-flex h-[var(--toolbar-control-h)] max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] focus-visible:shadow-[0_0_0_3px_var(--color-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35";

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
      <span className="hidden text-xs font-medium md:inline">
        {isPrev ? "Previous" : "Next"}
      </span>
      {!isPrev && <ChevronRight />}
    </button>
  );
}

function PeriodSelectTrigger({
  listbox,
  selectedPeriod,
}: {
  readonly listbox: PeriodListboxNav;
  readonly selectedPeriod: ReportPeriod | undefined;
}) {
  const {
    open,
    activeIdx,
    hasOptions,
    optionIdPrefix,
    triggerRef,
    listboxId,
    toggleOpen,
    handleTriggerKeyDown,
  } = listbox;
  return (
    <div className="relative min-w-0 flex-1 md:flex-none md:w-[24ch]">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label="Select reporting period"
        title={selectedPeriod ? periodLabel(selectedPeriod) : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && hasOptions ? `${optionIdPrefix}${activeIdx}` : undefined
        }
        className="flex h-[var(--toolbar-control-h)] w-full cursor-pointer items-center gap-1.5 truncate rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-2 pr-7 text-left text-[13px] font-semibold text-[var(--color-foreground)] max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="truncate">
          {selectedPeriod ? periodLabel(selectedPeriod) : ""}
        </span>
        {/* R30: no in-trigger Submitted badge — the header already announces
            the same displayed-period status; the marker stays in the listbox. */}
        {selectedPeriod?.archived && <ArchivedBadge />}
      </button>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]">
        <ChevronDown />
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
      className="flex min-w-0 max-w-full shrink-0 basis-full items-center gap-1.5 md:basis-auto"
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
// has been measured.
function PeriodOptionsPanel({
  listbox,
  selection,
}: {
  readonly listbox: PeriodListboxNav;
  readonly selection: PeriodNavigatorSelection;
}) {
  if (!listbox.open || !listbox.panelPos) {
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
