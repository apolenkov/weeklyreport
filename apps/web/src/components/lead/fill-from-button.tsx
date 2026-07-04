"use client";

import { useEffect, useRef, useState } from "react";

import { FillFromConfirmDialog } from "./fill-from-confirm-dialog";
import { FillFromDropdownPanel } from "./fill-from-dropdown-panel";
import type { ReportPeriod } from "./mock-data";

// polish-lead-toolbar-and-risk-dialog 1.3: the fill-from control is a single
// split-button — a wider main segment (copy = fill from most recent submitted
// period) joined to a narrow chevron segment (open the past-report picker).
// Both segments keep distinct <button> elements + aria-labels so the
// accessible split-button pattern holds; the chevron keeps dropdownTriggerRef
// for portal positioning.
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

function ChevronDown() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

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
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    right: number;
  } | null>(null);

  const pastPeriods = periods.filter((p) => !p.isCurrent && p.isSubmitted);
  const previousPeriod = pastPeriods.at(0);

  const filteredPeriods = pastPeriods.filter(
    (p) =>
      p.weekLabel.toLowerCase().includes(search.toLowerCase()) ||
      p.dateRange.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const wrapContains = wrapRef.current?.contains(target);
      const panelContains = dropdownPanelRef.current?.contains(target);
      if (!wrapContains && !panelContains) {
        setShowDropdown(false);
      }
    }
    if (showDropdown)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  // Position the dropdown via portal to escape the toolbar's overflow clip.
  useEffect(() => {
    if (!showDropdown) return;
    const update = () => {
      const r = dropdownTriggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setDropdownPos({
        top: r.bottom + 4,
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
  }, [showDropdown]);

  function handleFillPrevious() {
    if (!previousPeriod) return;
    setSelectedPeriod(previousPeriod);
    setShowConfirm(true);
  }

  function handleFillFromPeriod(period: ReportPeriod) {
    setSelectedPeriod(period);
    setShowDropdown(false);
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
      {/* polish-lead-toolbar-and-risk-dialog 1.3: one split-button — a wider
          main segment (copy = fill from most recent submitted period) joined
          to a slim chevron segment (open the past-report picker). The dropdown
          still portals to document.body with position:fixed, which is what
          frees it from the toolbar's overflow clip (bug 2026-06-10). */}
      <div className="relative inline-flex items-center" ref={wrapRef}>
        <div className={SPLIT_BUTTON_CONTAINER_CLASS}>
          <button
            type="button"
            aria-label="Fill from most recent submitted period"
            title={lockedReason ?? "Fill from most recent submitted period"}
            onClick={handleFillPrevious}
            disabled={disabled || locked || !previousPeriod}
            className={SPLIT_BUTTON_MAIN_CLASS}
          >
            <CopyIcon />
          </button>

          <button
            ref={dropdownTriggerRef}
            type="button"
            aria-label="Choose past report to fill from"
            title={lockedReason ?? "Choose past report to fill from"}
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={disabled || locked}
            className={SPLIT_BUTTON_CHEVRON_CLASS}
          >
            <ChevronDown />
          </button>
        </div>
      </div>

      {/* Dropdown list — portal to document.body so the toolbar's
          overflow clip cannot truncate it; position:fixed from the trigger
          rect, tracked on scroll + resize. */}
      <FillFromDropdownPanel
        open={showDropdown}
        pos={dropdownPos}
        panelRef={dropdownPanelRef}
        pastPeriods={pastPeriods}
        filteredPeriods={filteredPeriods}
        search={search}
        onSearchChange={setSearch}
        onSelect={handleFillFromPeriod}
      />

      {/* Confirmation dialog — portal to document.body so ancestor
          transform/filter does not break position:fixed containment */}
      <FillFromConfirmDialog
        open={showConfirm}
        selectedPeriod={selectedPeriod}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
