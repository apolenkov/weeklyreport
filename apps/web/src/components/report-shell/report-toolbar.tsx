import type { ReactNode } from "react";

/**
 * Shared "unified pill bar" frame tokens (border / hover surface / radius /
 * padding). The single source of the period toolbar framing.
 */
export const REPORT_TOOLBAR_FRAME_CLASS =
  "rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5";

/**
 * Sticky variant of the frame (opt-in `sticky` prop). Pins the bar to the top
 * of the viewport on scroll. Differences from the resting frame are
 * positioning/surface only: an OPAQUE background (no `/70`) so scrolling
 * content does not bleed through, a shadow elevation cue, and a z-index BELOW
 * the NavBar dropdown layer (NavBar dropdowns use `z-30`) but above report
 * content. The resting frame above stays byte-identical for non-opt-in usages.
 */
const REPORT_TOOLBAR_FRAME_STICKY_CLASS =
  "rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-[var(--color-surface-hover)] px-2 py-1.5 sticky top-0 z-20 shadow-md";

/**
 * One toolbar row. `overflow-x-auto` (not `-clip`) keeps every control
 * reachable via horizontal scroll at narrow widths
 * (report-toolbar-layout: narrow-width reachability).
 */
const REPORT_TOOLBAR_ROW_CLASS =
  "flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap";

interface ReportToolbarProps {
  /**
   * The Context-control bar — the only row the bordered toolbar carries.
   * Controls that change which report is shown or how it is presented (period
   * navigation, show-archived filter, scope, view mode, expand-all, Agent
   * review). Document actions do NOT live here — they render on the page header
   * line via {@link DocumentActionGroup} (report-toolbar-layout).
   */
  contextControls?: ReactNode;
  /**
   * Opt-in: pin the bar to the top of the viewport on scroll (lead context bar
   * only). Default false so every other usage keeps its non-sticky flow.
   */
  sticky?: boolean;
}

/**
 * report-toolbar-layout: the bordered report toolbar holds exactly one row —
 * the Context-control bar. Document actions (Save, Submit Section, Publish &
 * Lock, Fill-From, export, Move-to-archive) render on the page header line
 * instead, so the box no longer stacks two rows of unequal height.
 */
export function ReportToolbar({
  contextControls,
  sticky = false,
}: ReportToolbarProps) {
  if (contextControls === undefined) return null;
  const frameClass = sticky
    ? REPORT_TOOLBAR_FRAME_STICKY_CLASS
    : REPORT_TOOLBAR_FRAME_CLASS;
  return (
    <div
      data-testid="report-toolbar"
      role="group"
      aria-label="Context controls"
      // Start-aligned: `justify-end` would push overflow past the left edge
      // where `overflow-x-auto` cannot scroll it back into reach, clipping the
      // leftmost control at narrow widths (report-toolbar-layout: narrow-width
      // reachability).
      className={`${frameClass} ${REPORT_TOOLBAR_ROW_CLASS} justify-start`}
    >
      {contextControls}
    </div>
  );
}

/**
 * report-toolbar-layout: the page header line's document-action group. Controls
 * that operate on the report document live here (right-aligned beside the
 * title/status block), labeled as a group for assistive tech and rendered
 * before the context bar in the DOM so keyboard focus traverses document
 * actions first. `flex-wrap` keeps every action reachable at narrow widths.
 */
export function DocumentActionGroup({ children }: { children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label="Document actions"
      className="flex min-w-0 flex-wrap items-center justify-end gap-1.5"
    >
      {children}
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
 * not a control, so it sits on the header line rather than inside the toolbar.
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
