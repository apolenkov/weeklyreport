'use client';

import { useState, useRef, useEffect } from 'react';

import type { ReportPeriod } from './mock-data';

type FillFromButtonProps = {
  readonly periods: ReportPeriod[];
  /**
   * Called with the SECTION id of the chosen period (NOT the report id) so the
   * parent can wire `leadForm.fillFrom({ targetSectionId, sourceSectionId })`.
   */
  readonly onFillFrom?: (sourceSectionId: string) => void;
  readonly disabled?: boolean;
};

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" stroke="currentColor" fill="none" strokeWidth={2}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function FillFromButton({ periods, onFillFrom, disabled = false }: FillFromButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod | null>(null);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const pastPeriods = periods.filter((p) => !p.isCurrent && p.isSubmitted);
  const previousPeriod = pastPeriods[0];

  const filteredPeriods = pastPeriods.filter(
    (p) =>
      p.weekLabel.toLowerCase().includes(search.toLowerCase()) ||
      p.dateRange.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      <div className="relative inline-flex" ref={wrapRef}>
        {/* Primary button */}
        <button
          type="button"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-l-[var(--radius-pill)] rounded-r-none border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold tracking-[-0.01em] text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleFillPrevious}
          disabled={disabled || !previousPeriod}
          title="Fill from most recent submitted period"
        >
          <CopyIcon />
          Fill from Previous
        </button>

        {/* Dropdown trigger */}
        <button
          type="button"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] min-w-[44px] items-center justify-center rounded-l-none rounded-r-[var(--radius-pill)] border border-l-0 border-[var(--color-border)] bg-transparent px-3 text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={disabled}
          title="Fill from a specific past report"
          aria-label="Choose past report to fill from"
        >
          <ChevronDown />
        </button>

        {/* Dropdown list */}
        {showDropdown && (
          <div className="absolute right-0 top-full z-50 mt-1 w-[340px] rounded-xl border border-[var(--color-muted)] bg-white p-3 shadow-lg">
            <input
              type="text"
              className="mb-2 w-full rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-1.5 pl-8 text-[13px] text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              placeholder="Search reports…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='M21 21l-4.35-4.35'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: '10px center',
              }}
            />
            <div className="max-h-[200px] space-y-1 overflow-y-auto">
              {filteredPeriods.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                  style={
                    idx === 0
                      ? { background: 'var(--color-success)', border: '1.5px solid var(--color-starbucks-accent)' }
                      : { background: 'var(--color-background)', border: '1.5px solid transparent' }
                  }
                  onClick={() => handleFillFromPeriod(p)}
                >
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {p.weekLabel} &middot; {p.dateRange}
                    </div>
                    <div className="text-[11px] text-[var(--color-muted-foreground)]">
                      {p.productCount ?? 0} products &middot; {p.itemCount ?? 0} items &middot; {p.riskCount ?? 0} risks
                    </div>
                  </div>
                  {idx === 0 && (
                    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-primary)]">
                      Previous
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
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
              This will overwrite your current draft with data from{' '}
              <strong>{selectedPeriod?.weekLabel} ({selectedPeriod?.dateRange})</strong>.
              Current Week items, Risks, and Decisions will be replaced.
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
        </div>
      )}
    </>
  );
}
