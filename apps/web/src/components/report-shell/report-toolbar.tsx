import type { ReactNode } from "react";

/**
 * Shared "unified pill bar" frame tokens (border / hover surface / radius /
 * padding). The single source of the period toolbar framing.
 */
export const REPORT_TOOLBAR_FRAME_CLASS =
  "rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5";

/**
 * One toolbar row. `overflow-x-auto` (not `-clip`) keeps every control
 * reachable via horizontal scroll at narrow widths
 * (report-toolbar-layout: narrow-width reachability).
 */
const REPORT_TOOLBAR_ROW_CLASS =
  "flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap";

interface ReportToolbarProps {
  /**
   * Top row — controls that operate on the report document (Save, Submit
   * Section, Publish & Lock, Fill-From, PDF export, Move to archive).
   */
  documentActions?: ReactNode;
  /**
   * Bottom row — controls that only change which report is shown or how it is
   * presented (period navigation, show-archived filter, scope, view mode,
   * expand-all, Agent review).
   */
  contextControls?: ReactNode;
}

/**
 * report-toolbar-layout: the report toolbar groups its controls into a top
 * Document action row and a bottom Context control row, split by one axis —
 * "operates on the report document" vs "changes which / how it is shown". Both
 * rows live in one shared container (the report-toolbar-parity single-container
 * contract); the top row precedes the bottom row in the DOM so keyboard focus
 * traverses document actions before context controls without manual tabindex.
 */
export function ReportToolbar({
  documentActions,
  contextControls,
}: ReportToolbarProps) {
  return (
    <div
      data-testid="report-toolbar"
      className={`${REPORT_TOOLBAR_FRAME_CLASS} flex flex-col gap-1.5`}
    >
      {documentActions !== undefined && (
        <div
          role="group"
          aria-label="Document actions"
          className={`${REPORT_TOOLBAR_ROW_CLASS} justify-end`}
        >
          {documentActions}
        </div>
      )}
      {contextControls !== undefined && (
        <div
          role="group"
          aria-label="Context controls"
          className={`${REPORT_TOOLBAR_ROW_CLASS} justify-start`}
        >
          {contextControls}
        </div>
      )}
    </div>
  );
}

interface ReportToolbarCenterLabelProps {
  readonly label: string;
  readonly detail: string;
}

/**
 * Context label for the report header (department name plus a short page
 * descriptor), shared by the head review shell and the standalone weekly
 * report page so the wording and styling stay in one place. It is a label,
 * not a control, so the two-row layout keeps it on the header line rather than
 * inside either action row.
 */
export function ReportToolbarCenterLabel({
  label,
  detail,
}: ReportToolbarCenterLabelProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
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
