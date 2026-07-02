"use client";

import { type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

// Custom listbox geometry (D3): the panel portals to document.body so the
// toolbar's overflow clip cannot truncate it. Mirrors the FillFromButton
// portal — position:fixed from the trigger rect, scroll/resize tracked.
export const PERIOD_PANEL_MAX_HEIGHT_PX = 280;

export interface PeriodOption {
  id: string;
  dateRange: string;
  isCurrent: boolean;
  archived: boolean;
  // W3: per-lead submitted marker. Only ever true for the lead surface and
  // only on the currently-selected period (the navigator has a submittedAt
  // value for the displayed period alone, never the whole history).
  submitted?: boolean;
}

interface PeriodListboxPanelProps {
  readonly options: PeriodOption[];
  readonly selectedId: string | undefined;
  readonly activeIdx: number;
  readonly pos: { top: number; left: number; width: number };
  readonly panelRef: React.RefObject<HTMLDivElement | null>;
  // W4: per-instance scoped ids (useId) so two navigators on one page never
  // collide on the listbox / option DOM ids that aria-controls and
  // aria-activedescendant point at.
  readonly listboxId: string;
  readonly optionIdPrefix: string;
  readonly onHover: (idx: number) => void;
  readonly onSelect: (periodId: string) => void;
  readonly onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Neutral identity badge (D2) — muted pill, never a status hue. Shared by the
 * trigger and the listbox options, matching the FillFromButton "Archived" pill.
 */
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
 * Per-lead submitted marker (W3) — neutral pill, never a status hue. Sourced
 * only from the current lead's `ReportSection.submittedAt`; the head/viewer
 * navigators never render it (they do not pass the markers prop).
 */
export function SubmittedBadge() {
  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--color-primary)]">
      Submitted
    </span>
  );
}

/**
 * Portaled listbox panel (D3). Lives in document.body so the toolbar's
 * overflow clip cannot truncate it; position:fixed from the trigger rect,
 * tracked on scroll + resize (mirrors FillFromButton).
 */
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
      {options.map((opt, idx) => {
        const isSelected = opt.id === selectedId;
        return (
          <div
            key={opt.id}
            id={`${optionIdPrefix}${idx}`}
            role="option"
            tabIndex={-1}
            aria-selected={isSelected}
            className={[
              "flex max-md:min-h-[var(--touch-target-min)] cursor-pointer items-center gap-2 px-3 py-2 text-[13px]",
              isSelected
                ? "font-semibold text-[var(--color-starbucks-accent)]"
                : "text-[var(--color-foreground)]",
              idx === activeIdx ? "bg-[var(--color-surface-hover)]" : "",
            ].join(" ")}
            onMouseEnter={() => onHover(idx)}
            onMouseDown={(e) => {
              // Keep focus on the trigger; prevent the panel from stealing it.
              e.preventDefault();
              onSelect(opt.id);
            }}
          >
            <span className="flex-1 truncate">{periodLabel(opt)}</span>
            {opt.submitted && <SubmittedBadge />}
            {opt.archived && <ArchivedBadge />}
            {isSelected && (
              <span aria-hidden="true" className="text-xs">
                ✓
              </span>
            )}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
