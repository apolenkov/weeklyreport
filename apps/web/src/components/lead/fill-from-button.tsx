"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { ReportPeriod } from "./mock-data";

interface FillFromButtonProps {
  readonly periods: ReportPeriod[];
  /**
   * Called with the SECTION id of the chosen period (NOT the report id) so the
   * parent can wire `leadForm.fillFrom({ targetSectionId, sourceSectionId })`.
   */
  readonly onFillFrom?: (sourceSectionId: string) => void;
  readonly disabled?: boolean;
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

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

export function FillFromButton({
  periods,
  onFillFrom,
  disabled = false,
}: FillFromButtonProps) {
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
      {/* Pill silhouette comes from rounding the buttons themselves; the
          dropdown portals to document.body with position:fixed, which is what
          frees it from the toolbar's overflow clip (bug 2026-06-10). */}
      <div
        className="relative inline-flex rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white/70"
        ref={wrapRef}
      >
        {/* Primary button */}
        <button
          type="button"
          className="btn-press inline-flex min-h-8 items-center gap-1 rounded-l-[var(--radius-pill)] bg-transparent px-2.5 py-1 text-[13px] font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleFillPrevious}
          disabled={disabled || !previousPeriod}
          title="Fill from most recent submitted period"
        >
          <CopyIcon />
          Fill
        </button>

        {/* Dropdown trigger */}
        <button
          ref={dropdownTriggerRef}
          type="button"
          className="btn-press inline-flex min-h-8 min-w-[34px] items-center justify-center rounded-r-[var(--radius-pill)] border-l border-[rgba(0,117,74,0.18)] bg-transparent px-1.5 text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={disabled}
          title="Fill from a specific past report"
          aria-label="Choose past report to fill from"
        >
          <ChevronDown />
        </button>
      </div>

      {/* Dropdown list — portal to document.body so the toolbar's
          overflow clip cannot truncate it; position:fixed from the trigger
          rect, tracked on scroll + resize. */}
      {showDropdown &&
        dropdownPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownPanelRef}
            className="fixed z-50 w-[340px] rounded-xl border border-[var(--color-muted)] bg-white p-3 shadow-lg"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
          >
            {pastPeriods.length > 0 && (
              <div className="relative mb-2">
                <SearchIcon />
                <input
                  type="text"
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-1.5 pl-8 text-[13px] text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
                  placeholder="Search reports…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
            <div className="max-h-[200px] space-y-1 overflow-y-auto">
              {pastPeriods.length === 0 ? (
                <p className="px-2 py-3 text-center text-[13px] text-[var(--color-muted-foreground)]">
                  No submitted past reports found.
                </p>
              ) : filteredPeriods.length === 0 ? (
                <p className="px-2 py-3 text-center text-[13px] text-[var(--color-muted-foreground)]">
                  No reports match your search.
                </p>
              ) : null}
              {filteredPeriods.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  className={[
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg p-2.5 text-left transition-colors",
                    idx === 0
                      ? "border border-[var(--color-starbucks-accent)] bg-[var(--color-success)] hover:brightness-95"
                      : "border border-transparent bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)]",
                  ].join(" ")}
                  onClick={() => handleFillFromPeriod(p)}
                >
                  <div className="flex-1">
                    {/* Badges share the title line, right-aligned — one
                        horizontal level for Archived and Previous
                        (user feedback 2026-06-10). */}
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className="flex-1 truncate">
                        {p.weekLabel} &middot; {p.dateRange}
                      </span>
                      {p.archived && (
                        <span className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-muted-foreground)]">
                          Archived
                        </span>
                      )}
                      {idx === 0 && (
                        <span className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-2 py-0.5 text-[9px] font-semibold text-white">
                          Previous
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--color-muted-foreground)]">
                      {p.productCount ?? 0} products &middot; {p.itemCount ?? 0}{" "}
                      items &middot; {p.riskCount ?? 0} risks
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {/* Confirmation dialog — portal to document.body so ancestor
          transform/filter does not break position:fixed containment */}
      {showConfirm &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
            <div
              className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm fill from previous"
            >
              <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
                Fill from {selectedPeriod?.weekLabel}?
              </h3>
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                This will overwrite your current draft with data from{" "}
                <strong>
                  {selectedPeriod?.weekLabel} ({selectedPeriod?.dateRange})
                </strong>
                . Current Week items, Risks, and Decisions will be replaced.
                Priorities will NOT be filled.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
                  onClick={handleConfirm}
                >
                  Replace &amp; Fill
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
