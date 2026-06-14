import type { ReactNode } from "react";

/**
 * Shared "unified pill bar" frame tokens (border / hover surface / radius /
 * padding). The single source of the toolbar framing so the period
 * `ReportToolbar` and the action-row `ReportActionsPill`
 * (unify-top-action-toolbars D1) stay visually identical without forking the
 * literal class string. Flex/wrap classes are NOT included here: each consumer
 * picks its own (the period bar clips on narrow widths; the actions pill wraps).
 */
export const REPORT_TOOLBAR_FRAME_CLASS =
  "rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5";

interface ReportToolbarProps {
  periodNavigator?: ReactNode;
  archiveToggle?: ReactNode;
  leadingExtras?: ReactNode;
  trailingExtras?: ReactNode;
}

export function ReportToolbar({
  periodNavigator,
  archiveToggle,
  leadingExtras,
  trailingExtras,
}: ReportToolbarProps) {
  return (
    <div
      data-testid="report-toolbar"
      className={`${REPORT_TOOLBAR_FRAME_CLASS} flex flex-nowrap items-center justify-between gap-2 overflow-x-clip whitespace-nowrap`}
    >
      {/* UAT 2026-05-22: archive toggle sits next to the period selector
          (lead + head share this toolbar, so the move applies to both). */}
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
        {periodNavigator}
        {archiveToggle}
      </div>
      {leadingExtras}
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
        {trailingExtras}
      </div>
    </div>
  );
}

interface ReportActionsPillProps {
  /** Left intent group, e.g. scope + view-mode (head) or "Back" (viewer). */
  readonly leftGroup?: ReactNode;
  /** Right intent group, e.g. present / print / agent-review. */
  readonly rightGroup: ReactNode;
}

/**
 * Unified action-row pill (unify-top-action-toolbars D1): the report-surface
 * action controls share the same frame as the period `ReportToolbar`, grouped
 * by intent into a left and a right cluster split by `justify-between`.
 *
 * One intentional deviation from `ReportToolbar`: this bar uses `flex-wrap`
 * (NOT clip), because it carries more controls and MUST NOT hide any — it wraps
 * to a second line on narrow widths instead. Within a group the gap is 1.5;
 * between groups the `justify-between` split mirrors the lead "grouped by
 * intent" arrangement.
 */
export function ReportActionsPill({
  leftGroup,
  rightGroup,
}: ReportActionsPillProps) {
  return (
    <div
      data-testid="report-actions-pill"
      className={`${REPORT_TOOLBAR_FRAME_CLASS} flex flex-wrap items-center justify-between gap-x-4 gap-y-2`}
    >
      <div className="flex flex-wrap items-center gap-1.5">{leftGroup}</div>
      <div className="flex flex-wrap items-center gap-1.5">{rightGroup}</div>
    </div>
  );
}

interface ReportToolbarCenterLabelProps {
  readonly label: string;
  readonly detail: string;
}

/**
 * Center-slot context label for the toolbar's `leadingExtras`
 * (head-toolbar-parity D2): department name plus a short page descriptor,
 * shared by the head review shell and the standalone weekly report page so
 * the wording and styling stay in one place.
 */
export function ReportToolbarCenterLabel({
  label,
  detail,
}: ReportToolbarCenterLabelProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
      <span className="truncate text-sm text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <span className="text-[var(--color-muted-foreground)]">&middot;</span>
      <span className="text-sm text-[var(--color-muted-foreground)]">
        {detail}
      </span>
    </div>
  );
}
