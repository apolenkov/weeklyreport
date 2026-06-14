import type { ReactNode } from "react";

/**
 * Shared "unified pill bar" frame tokens (border / hover surface / radius /
 * padding). The single source of the period toolbar framing. Flex/wrap classes
 * are NOT included here: each consumer picks its own.
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
