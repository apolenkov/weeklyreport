"use client";

import { type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

// Portals to document.body so the toolbar's overflow clip cannot truncate it
// (position:fixed from the trigger rect; scroll/resize tracked — same pattern
// as FillFromButton).
const PERIOD_PANEL_MAX_HEIGHT_PX = 280;

interface PeriodOption {
  readonly id: string;
  readonly dateRange: string;
  readonly isCurrent: boolean;
  readonly archived: boolean;
  // Per-lead submitted marker. Only ever true for the lead surface and only on
  // the currently-selected period (the navigator has a submittedAt value for
  // the displayed period alone, never the whole history).
  readonly submitted?: boolean;
}

interface PeriodListboxPanelProps {
  readonly options: readonly PeriodOption[];
  readonly selectedId: string | undefined;
  readonly activeIdx: number;
  readonly pos: {
    readonly top: number;
    readonly left: number;
    readonly width: number;
  };
  readonly panelRef: React.RefObject<HTMLDivElement | null>;
  // Per-instance scoped ids (useId) so two navigators on one page never
  // collide on the listbox / option DOM ids that aria-controls and
  // aria-activedescendant point at.
  readonly listboxId: string;
  readonly optionIdPrefix: string;
  readonly onHover: (idx: number) => void;
  readonly onSelect: (periodId: string) => void;
  readonly onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
}

/** Neutral identity badge — muted pill, never a status hue. Shared by the trigger and listbox options. */
export function ArchivedBadge() {
  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--color-muted-foreground)]">
      Archived
    </span>
  );
}

export const periodLabel = (p: { dateRange: string; isCurrent: boolean }) =>
  p.isCurrent ? `${p.dateRange} (Current)` : p.dateRange;

/**
 * Per-lead submitted marker — neutral pill, never a status hue. Sourced only
 * from the current lead's `ReportSection.submittedAt`; head/viewer navigators
 * never pass the markers prop.
 */
export function SubmittedBadge() {
  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--color-primary)]">
      Submitted
    </span>
  );
}

function PeriodOptionRow({
  option,
  optionId,
  isSelected,
  isActive,
  onHover,
  onSelect,
}: {
  readonly option: PeriodOption;
  readonly optionId: string;
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly onHover: () => void;
  readonly onSelect: () => void;
}) {
  return (
    <div
      id={optionId}
      role="option"
      tabIndex={-1}
      aria-selected={isSelected}
      className={[
        "flex max-md:min-h-[var(--touch-target-min)] cursor-pointer items-center gap-2 px-3 py-2 text-[13px]",
        isSelected
          ? "font-semibold text-[var(--color-starbucks-accent)]"
          : "text-[var(--color-foreground)]",
        isActive ? "bg-[var(--color-surface-hover)]" : "",
      ].join(" ")}
      onMouseEnter={onHover}
      onMouseDown={(e) => {
        // Keep focus on the trigger; prevent the panel from stealing it.
        e.preventDefault();
        onSelect();
      }}
    >
      <span className="flex-1 truncate">{periodLabel(option)}</span>
      {option.submitted && <SubmittedBadge />}
      {option.archived && <ArchivedBadge />}
      {isSelected && (
        <span aria-hidden="true" className="text-xs">
          ✓
        </span>
      )}
    </div>
  );
}

export function PeriodListboxPanel({
  options,
  selectedId,
  activeIdx,
  pos,
  panelRef,
  listboxId,
  optionIdPrefix,
  onHover,
  onSelect,
  onKeyDown,
}: PeriodListboxPanelProps) {
  return createPortal(
    <div
      ref={panelRef}
      id={listboxId}
      role="listbox"
      aria-label="Reporting period"
      tabIndex={-1}
      className="fixed z-50 overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-white py-1 shadow-lg"
      style={{
        top: pos.top,
        left: pos.left,
        minWidth: pos.width,
        maxHeight: PERIOD_PANEL_MAX_HEIGHT_PX,
      }}
      onKeyDown={onKeyDown}
    >
      {options.map((opt, idx) => (
        <PeriodOptionRow
          key={opt.id}
          option={opt}
          optionId={`${optionIdPrefix}${idx}`}
          isSelected={opt.id === selectedId}
          isActive={idx === activeIdx}
          onHover={() => onHover(idx)}
          onSelect={() => onSelect(opt.id)}
        />
      ))}
    </div>,
    document.body,
  );
}
