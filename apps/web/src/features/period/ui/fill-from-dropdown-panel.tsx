import type { RefObject } from "react";
import { createPortal } from "react-dom";

import type { ReportPeriod } from "../../report-sections";

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

function PeriodSearchInput({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div className="relative mb-2">
      <SearchIcon />
      <input
        type="text"
        className="w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-1.5 pl-8 text-[13px] text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
        placeholder="Search reports…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PeriodRowButton({
  period,
  isPrevious,
  onSelect,
}: {
  readonly period: ReportPeriod;
  readonly isPrevious: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "flex w-full cursor-pointer items-center gap-3 rounded-lg p-2.5 text-left transition-colors",
        isPrevious
          ? "border border-[var(--color-starbucks-accent)] bg-[var(--color-success)] hover:brightness-95"
          : "border border-transparent bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)]",
      ].join(" ")}
      onClick={onSelect}
    >
      <div className="flex-1">
        {/* Badges share the title line, right-aligned — one
            horizontal level for Archived and Previous. */}
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="flex-1 truncate">
            {period.weekLabel} &middot; {period.dateRange}
          </span>
          {period.archived && (
            <span className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-muted-foreground)]">
              Archived
            </span>
          )}
          {isPrevious && (
            <span className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-2 py-0.5 text-[9px] font-semibold text-white">
              Previous
            </span>
          )}
        </div>
        <div className="text-[11px] text-[var(--color-muted-foreground)]">
          {period.productCount ?? 0} products &middot; {period.itemCount ?? 0}{" "}
          items &middot; {period.riskCount ?? 0} risks
        </div>
      </div>
    </button>
  );
}

interface FillFromDropdownPanelProps {
  readonly open: boolean;
  readonly pos: { top: number; right: number } | null;
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly pastPeriods: readonly ReportPeriod[];
  readonly filteredPeriods: readonly ReportPeriod[];
  /**
   * The real previous period's id (the one the main split-button fills),
   * independent of search filtering — badges/highlights key off this
   * identity, never off filtered-array position.
   */
  readonly previousPeriodId: string | undefined;
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly onSelect: (period: ReportPeriod) => void;
}

/**
 * Fill From Dropdown Panel.
 * @param props - The props argument.
 */
export function FillFromDropdownPanel({
  open,
  pos,
  panelRef,
  pastPeriods,
  filteredPeriods,
  previousPeriodId,
  search,
  onSearchChange,
  onSelect,
}: FillFromDropdownPanelProps) {
  if (!open || !pos || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-50 w-[340px] rounded-xl border border-[var(--color-muted)] bg-white p-3 shadow-lg"
      style={{ top: pos.top, right: pos.right }}
    >
      {pastPeriods.length > 0 && (
        <PeriodSearchInput value={search} onChange={onSearchChange} />
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
        {filteredPeriods.map((p) => (
          <PeriodRowButton
            key={p.id}
            period={p}
            isPrevious={p.id === previousPeriodId}
            onSelect={() => onSelect(p)}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
