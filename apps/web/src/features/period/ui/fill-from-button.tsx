"use client";

import { ChevronDown } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";

import { ConfirmationDialog } from "../../../shared/ui/confirmation-dialog";
import type { ReportPeriod } from "../../report-sections";
import { sortMostRecentFirst } from "./fill-from-button-helpers";
import { FillFromDropdownPanel } from "./fill-from-dropdown-panel";

// The fill-from control is a single split-button — a wider main segment
// (copy = fill from most recent submitted period) joined to a narrow chevron
// segment (open the past-report picker). Both segments keep distinct <button>
// elements + aria-labels so the accessible split-button pattern holds; the
// chevron keeps dropdownTriggerRef for portal positioning.
const SPLIT_BUTTON_CONTAINER_CLASS =
  "inline-flex h-[var(--toolbar-control-h)] shrink-0 items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-white/70 text-[var(--color-foreground)]";
const SPLIT_BUTTON_SEGMENT_CLASS =
  "btn-press inline-flex h-full items-center justify-center transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";
// Main segment is wider (copy icon); chevron segment is a slim attached caret
// separated by a hairline divider.
// Below `md` both segments floor their WIDTH at the touch target (the shared
// container already floors the height via --toolbar-control-h).
const SPLIT_BUTTON_MAIN_CLASS = `${SPLIT_BUTTON_SEGMENT_CLASS} px-2.5 max-md:min-w-[var(--touch-target-min)]`;
const SPLIT_BUTTON_CHEVRON_CLASS = `${SPLIT_BUTTON_SEGMENT_CLASS} border-l border-[var(--color-border)] px-1.5 max-md:min-w-[var(--touch-target-min)]`;
const DROPDOWN_OFFSET_PX = 4;

interface FillFromButtonProps {
  readonly periods: ReportPeriod[];
  /**
   * Called with the SECTION id of the chosen period (NOT the report id) so the
   * parent can wire `leadForm.fillFrom({ targetSectionId, sourceSectionId })`.
   */
  readonly onFillFrom?: (sourceSectionId: string) => void;
  readonly disabled?: boolean;
  /**
   * Set when the target section carries published-lineage records (a reopened
   * period): the server's fillFrom guard rejects every source
   * (PUBLISHED_RECORD_LOCKED), so both segments are disabled and this string
   * is surfaced as the tooltip. UI-only — the server guard stays the
   * enforcement point.
   */
  readonly lockedReason?: string;
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
  lockedReason,
  copyDisabled,
  chevronDisabled,
  chevronRef,
  onCopy,
  onToggleDropdown,
}: {
  readonly lockedReason: string | undefined;
  readonly copyDisabled: boolean;
  readonly chevronDisabled: boolean;
  readonly chevronRef: RefObject<HTMLButtonElement | null>;
  readonly onCopy: () => void;
  readonly onToggleDropdown: () => void;
}) {
  return (
    <div className={SPLIT_BUTTON_CONTAINER_CLASS}>
      <button
        type="button"
        aria-label="Fill from most recent submitted period"
        title={lockedReason ?? "Fill from most recent submitted period"}
        onClick={onCopy}
        disabled={copyDisabled}
        className={SPLIT_BUTTON_MAIN_CLASS}
      >
        <CopyIcon />
      </button>

      <button
        ref={chevronRef}
        type="button"
        aria-label="Choose past report to fill from"
        title={lockedReason ?? "Choose past report to fill from"}
        onClick={onToggleDropdown}
        disabled={chevronDisabled}
        className={SPLIT_BUTTON_CHEVRON_CLASS}
      >
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

// Position the dropdown via portal to escape the toolbar's overflow clip; the
// trigger moves with scroll/resize, so the position is re-read on both.
function useDropdownPosition(
  open: boolean,
  triggerRef: RefObject<HTMLButtonElement | null>,
) {
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    right: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setDropdownPos({
        top: r.bottom + DROPDOWN_OFFSET_PX,
        right: window.innerWidth - r.right,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef]);

  return dropdownPos;
}

/**
 * Fill From Button.
 * @param props - The props argument.
 */
export function FillFromButton({
  periods,
  onFillFrom,
  disabled = false,
  lockedReason,
}: FillFromButtonProps) {
  const locked = lockedReason !== undefined;
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const dropdownPanelRef = useRef<HTMLDivElement>(null);
  const dropdownPos = useDropdownPosition(showDropdown, dropdownTriggerRef);

  // `dateRange` is produced by `formatPeriodRangeWithYear`; sorting its start
  // defensively keeps the primary action correct if a caller loses the
  // mapper's newest-first ordering. Unknown display formats retain input order.
  const pastPeriods = sortMostRecentFirst(
    periods.filter((p) => !p.isCurrent && p.isSubmitted),
  );
  const previousPeriod = pastPeriods.at(0);

  const filteredPeriods = pastPeriods.filter(
    (p) =>
      p.weekLabel.toLowerCase().includes(search.toLowerCase()) ||
      p.dateRange.toLowerCase().includes(search.toLowerCase()),
  );

  // Every close path clears the leftover search query too, so reopening the
  // dropdown always starts unfiltered rather than pre-filtered by whatever
  // was typed last session.
  function closeDropdown() {
    setShowDropdown(false);
    setSearch("");
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const wrapContains = wrapRef.current?.contains(target);
      const panelContains = dropdownPanelRef.current?.contains(target);
      if (!wrapContains && !panelContains) {
        closeDropdown();
      }
    }
    if (showDropdown)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeDropdown();
    }
    if (showDropdown) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showDropdown]);

  function handleFillPrevious() {
    if (!previousPeriod) return;
    setSelectedPeriod(previousPeriod);
    setShowConfirm(true);
  }

  function handleFillFromPeriod(period: ReportPeriod) {
    setSelectedPeriod(period);
    closeDropdown();
    setShowConfirm(true);
  }

  function handleConfirm() {
    if (selectedPeriod) {
      onFillFrom?.(selectedPeriod.sourceSectionId);
    }
    setShowConfirm(false);
    setSelectedPeriod(null);
  }

  function handleCancel() {
    setShowConfirm(false);
    setSelectedPeriod(null);
  }

  return (
    <>
      <div className="relative inline-flex items-center" ref={wrapRef}>
        <SplitButton
          lockedReason={lockedReason}
          copyDisabled={disabled || locked || !previousPeriod}
          chevronDisabled={disabled || locked}
          chevronRef={dropdownTriggerRef}
          onCopy={handleFillPrevious}
          onToggleDropdown={() =>
            showDropdown ? closeDropdown() : setShowDropdown(true)
          }
        />
      </div>

      <FillFromDropdownPanel
        open={showDropdown}
        pos={dropdownPos}
        panelRef={dropdownPanelRef}
        pastPeriods={pastPeriods}
        filteredPeriods={filteredPeriods}
        previousPeriodId={previousPeriod?.id}
        search={search}
        onSearchChange={setSearch}
        onSelect={handleFillFromPeriod}
      />

      {selectedPeriod && (
        <ConfirmationDialog
          open={showConfirm}
          title={`Fill from ${selectedPeriod.weekLabel}?`}
          description={
            <>
              This will overwrite your current draft with data from{" "}
              <strong>
                {selectedPeriod.weekLabel} ({selectedPeriod.dateRange})
              </strong>
              . Current Week items, Risks, and Decisions will be replaced.
              Priorities will NOT be filled.
            </>
          }
          confirmLabel="Replace & Fill"
          onConfirm={handleConfirm}
          onClose={handleCancel}
        />
      )}
    </>
  );
}
