"use client";

import { TooltipProvider } from "@customreport/ui/components/ui/tooltip";
import { ChevronDown } from "lucide-react";
import { type RefObject, useId, useRef } from "react";

import { ReasonTooltip } from "../../../shared/ui/report-shell/reason-tooltip";
import type { ReportPeriod } from "../../report-sections";
import { sortMostRecentFirst } from "./fill-from-button-helpers";
import {
  FillFromConfirmDialog,
  type FillFromHandler,
  useFillFromConfirmation,
} from "./fill-from-confirmation";
import { FillFromDropdownPanel } from "./fill-from-dropdown-panel";
import { useFillFromDropdown } from "./use-fill-from-dropdown";

// One split button: a wide main segment (fill from the most recent submitted
// period) joined to a narrow chevron segment (open the past-report picker).
// Distinct <button> elements keep the accessible split-button pattern.
const SPLIT_BUTTON_CONTAINER_CLASS =
  "inline-flex h-[var(--toolbar-control-h)] shrink-0 items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-card)_70%,transparent)] text-[var(--color-foreground)]";
const SPLIT_BUTTON_SEGMENT_CLASS =
  "btn-press inline-flex h-full max-md:min-h-[var(--touch-target-min)] items-center justify-center transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";
// The container border consumes 2px from `h-full`; below `md`, each
// actionable segment therefore floors its own box at the touch target.
const SPLIT_BUTTON_MAIN_CLASS = `${SPLIT_BUTTON_SEGMENT_CLASS} px-2.5 max-md:min-w-[var(--touch-target-min)]`;
const SPLIT_BUTTON_CHEVRON_CLASS = `${SPLIT_BUTTON_SEGMENT_CLASS} border-l border-[var(--color-border)] px-1.5 max-md:min-w-[var(--touch-target-min)]`;

interface FillFromButtonProps {
  readonly periods: ReportPeriod[];
  // Uses section ids so the parent can wire fillFrom's target/source contract.
  readonly onFillFrom?: FillFromHandler | undefined;
  readonly disabled?: boolean | undefined;
  // Published-lineage records block both segments; the server guard remains
  // the enforcement point and this string is surfaced as the visible reason.
  readonly lockedReason?: string | undefined;
  // Archived periods exist but are filtered out of `periods`; the empty-state
  // hint then points at the archive toggle.
  readonly archivedHidden?: boolean | undefined;
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function SplitButton({
  wrapRef,
  copyReason,
  chevronReason,
  pending,
  copyRef,
  chevronRef,
  dropdownId,
  dropdownOpen,
  onCopy,
  onToggleDropdown,
}: {
  readonly wrapRef: RefObject<HTMLDivElement | null>;
  readonly copyReason: string | undefined;
  readonly chevronReason: string | undefined;
  readonly pending: boolean;
  readonly copyRef: RefObject<HTMLButtonElement | null>;
  readonly chevronRef: RefObject<HTMLButtonElement | null>;
  readonly dropdownId: string;
  readonly dropdownOpen: boolean;
  readonly onCopy: () => void;
  readonly onToggleDropdown: () => void;
}) {
  return (
    <div className="relative inline-flex items-center" ref={wrapRef}>
      <TooltipProvider>
        <div className={SPLIT_BUTTON_CONTAINER_CLASS}>
          <ReasonTooltip reason={copyReason}>
            <button
              ref={copyRef}
              type="button"
              aria-label="Fill from most recent submitted period"
              title={copyReason ? "" : "Fill from most recent submitted period"}
              onClick={copyReason ? undefined : onCopy}
              disabled={pending}
              aria-disabled={copyReason ? true : undefined}
              className={SPLIT_BUTTON_MAIN_CLASS}
            >
              <CopyIcon />
            </button>
          </ReasonTooltip>

          <ReasonTooltip reason={chevronReason}>
            <button
              ref={chevronRef}
              type="button"
              aria-label="Choose past report to fill from"
              aria-controls={dropdownOpen ? dropdownId : undefined}
              aria-expanded={dropdownOpen}
              title={chevronReason ? "" : "Choose past report to fill from"}
              onClick={chevronReason ? undefined : onToggleDropdown}
              disabled={pending}
              aria-disabled={chevronReason ? true : undefined}
              className={SPLIT_BUTTON_CHEVRON_CLASS}
            >
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>
          </ReasonTooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

// `dateRange` is produced by `formatPeriodRangeWithYear`; sorting its start
// defensively keeps the primary action correct if a caller loses the mapper's
// newest-first ordering. Unknown display formats retain input order.
const submittedPastPeriods = (periods: readonly ReportPeriod[]) =>
  sortMostRecentFirst(periods.filter((p) => !p.isCurrent && p.isSubmitted));

const filterBySearch = (periods: readonly ReportPeriod[], search: string) => {
  const query = search.toLowerCase();
  return periods.filter(
    (p) =>
      p.weekLabel.toLowerCase().includes(query) ||
      p.dateRange.toLowerCase().includes(query),
  );
};

export function FillFromButton({
  periods,
  onFillFrom,
  disabled = false,
  lockedReason,
  archivedHidden = false,
}: FillFromButtonProps) {
  const dropdown = useFillFromDropdown();
  const dropdownId = useId();
  const fill = useFillFromConfirmation(onFillFrom);
  const copyRef = useRef<HTMLButtonElement>(null);
  const pastPeriods = submittedPastPeriods(periods);
  const previousPeriod = pastPeriods.at(0);

  const requestConfirmation = (
    period: ReportPeriod | undefined,
    returnFocusRef: RefObject<HTMLButtonElement | null>,
  ) => {
    if (!period) return;
    returnFocusRef.current?.focus();
    fill.request(period);
  };

  const handleSelect = (period: ReportPeriod) => {
    dropdown.close();
    requestConfirmation(period, dropdown.triggerRef);
  };

  return (
    <>
      <SplitButton
        wrapRef={dropdown.wrapRef}
        copyReason={
          lockedReason ??
          (previousPeriod
            ? undefined
            : "No submitted past report to fill from.")
        }
        chevronReason={lockedReason}
        pending={disabled}
        copyRef={copyRef}
        chevronRef={dropdown.triggerRef}
        dropdownId={dropdownId}
        dropdownOpen={dropdown.open}
        onCopy={() => requestConfirmation(previousPeriod, copyRef)}
        onToggleDropdown={dropdown.toggle}
      />

      <FillFromDropdownPanel
        open={dropdown.open}
        id={dropdownId}
        pos={dropdown.pos}
        panelRef={dropdown.panelRef}
        pastPeriods={pastPeriods}
        archivedHidden={archivedHidden}
        filteredPeriods={filterBySearch(pastPeriods, dropdown.search)}
        previousPeriodId={previousPeriod?.id}
        search={dropdown.search}
        onSearchChange={dropdown.setSearch}
        onSelect={handleSelect}
      />

      <FillFromConfirmDialog
        period={fill.period}
        open={fill.open}
        pending={fill.pending}
        error={fill.error}
        onConfirm={fill.confirm}
        onClose={fill.cancel}
      />
    </>
  );
}
