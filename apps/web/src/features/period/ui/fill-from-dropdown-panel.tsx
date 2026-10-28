import type { RefObject } from "react";

import { countLabel } from "../../../shared/lib/format/pluralize";
import { DocumentBodyPortal } from "../../../shared/ui/dialogs/document-body-portal";
import type { ReportPeriod } from "../../report-sections";
import type { AnchoredPanelCoordinates } from "../model/use-anchored-panel-position";

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
      <label htmlFor="period-search" className="sr-only">
        Search reports
      </label>
      <input
        id="period-search"
        name="periodSearch"
        autoComplete="off"
        type="text"
        className="w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 py-1.5 pl-8 text-[13px] text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_var(--color-ring)] focus:outline-none"
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
        {/* The title never truncates: its intrinsic width is the floor, so
            when badges do not fit beside it they wrap to the next line. */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold">
          <span className="min-w-fit flex-1">
            {period.weekLabel} &middot; {period.dateRange}
          </span>
          {period.archived && (
            <span className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted-foreground)]">
              Archived
            </span>
          )}
          {isPrevious && (
            <span className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-2 py-0.5 text-xs font-semibold text-[var(--color-primary-foreground)]">
              Latest submitted
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--color-muted-foreground)]">
          {countLabel(period.productCount ?? 0, "product", "products")} &middot;{" "}
          {countLabel(period.itemCount ?? 0, "item", "items")} &middot;{" "}
          {countLabel(period.riskCount ?? 0, "risk", "risks")}
        </div>
      </div>
    </button>
  );
}

interface FillFromDropdownPanelProps {
  readonly open: boolean;
  readonly id: string;
  readonly pos: AnchoredPanelCoordinates | null;
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly pastPeriods: readonly ReportPeriod[];
  readonly filteredPeriods: readonly ReportPeriod[];
  // Keep the real previous-period identity independent of search filtering;
  // badges/highlights must not key off filtered-array position.
  readonly previousPeriodId: string | undefined;
  readonly archivedHidden: boolean;
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly onSelect: (period: ReportPeriod) => void;
}

export function FillFromDropdownPanel({
  open,
  id,
  pos,
  panelRef,
  pastPeriods,
  filteredPeriods,
  previousPeriodId,
  archivedHidden,
  search,
  onSearchChange,
  onSelect,
}: FillFromDropdownPanelProps) {
  if (!open || !pos) return null;
  return (
    <DocumentBodyPortal>
      <div
        id={id}
        ref={panelRef}
        role="region"
        aria-label="Past reports"
        className="fixed z-50 flex flex-col rounded-xl border border-[var(--color-muted)] bg-[var(--color-popover)] p-3 shadow-lg"
        style={{
          top: pos.top,
          bottom: pos.bottom,
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
        }}
      >
        {pastPeriods.length > 0 && (
          <PeriodSearchInput value={search} onChange={onSearchChange} />
        )}
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {pastPeriods.length === 0 ? (
            <p className="px-2 py-3 text-center text-[13px] text-[var(--color-muted-foreground)]">
              {archivedHidden
                ? "No submitted reports in open periods. Show closed (archived) report periods to see more."
                : "No submitted past reports found."}
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
      </div>
    </DocumentBodyPortal>
  );
}
