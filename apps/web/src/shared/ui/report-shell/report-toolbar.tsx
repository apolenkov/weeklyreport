import type { ReactNode } from "react";

// Shared period-toolbar frame tokens (border / hover surface / radius / padding).
const REPORT_TOOLBAR_FRAME_CLASS =
  "rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5";

// Sticky opt-in: opaque surface (no /70), shadow, z-20 under NavBar dropdowns
// (z-30). Resting frame above stays byte-identical for non-sticky usages.
const REPORT_TOOLBAR_FRAME_STICKY_CLASS =
  "rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-2 py-1.5 sticky top-0 z-20 shadow-md";

// Context controls wrap at narrow widths so every action remains visible and
// keyboard-reachable without creating a second horizontal scroll surface.
const REPORT_TOOLBAR_ROW_CLASS = "flex min-w-0 flex-wrap items-center gap-1.5";

interface ReportToolbarProps {
  // Context-control row only. Document actions render on the page header via
  // DocumentActionGroup (report-toolbar-layout).
  readonly contextControls?: ReactNode;
  // Opt-in pin to viewport top (lead context bar). Default false elsewhere.
  readonly sticky?: boolean;
}

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
      className={`${frameClass} ${REPORT_TOOLBAR_ROW_CLASS} justify-start`}
    >
      {contextControls}
    </div>
  );
}

// Page-header document-action group (Save, Submit, …). Renders before the
// context bar in the DOM so keyboard focus hits document actions first.
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

// Shared header label (department + page descriptor) for head review and
// standalone weekly report — wording/styling live in one place.
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
