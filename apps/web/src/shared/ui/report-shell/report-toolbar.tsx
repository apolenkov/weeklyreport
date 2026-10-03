import { type ReactNode, useEffect, useRef } from "react";

// Shared period-toolbar frame tokens (border / hover surface / radius / padding).
const REPORT_TOOLBAR_FRAME_CLASS =
  "rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5";

// Sticky opt-in: opaque surface (no /70), shadow, z-20 under NavBar dropdowns
// (z-30). Resting frame above stays byte-identical for non-sticky usages.
const REPORT_TOOLBAR_FRAME_STICKY_CLASS =
  "rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-2 py-1.5 md:sticky md:top-0 md:z-20 md:shadow-md";

// Context controls wrap at narrow widths so every action remains visible and
// keyboard-reachable without creating a second horizontal scroll surface.
const REPORT_TOOLBAR_ROW_CLASS =
  "flex min-w-0 flex-wrap items-center gap-1.5 md:flex-nowrap";

interface ReportToolbarProps {
  // Context-control row only. Document actions render on the page header via
  // DocumentActionGroup (report-toolbar-layout).
  readonly contextControls?: ReactNode;
  // Opt-in pin to viewport top (lead context bar). Default false elsewhere.
  readonly sticky?: boolean;
  readonly layoutKey?: string;
}

const SCROLL_OFFSET_VAR = "--sticky-toolbar-offset";
const SCROLL_OFFSET_GAP_PX = 16;

// Keeps anchored/focused targets below the real sticky toolbar height (app.css
// falls back to 5rem until this measures).
function useStickyScrollOffset(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty(
        SCROLL_OFFSET_VAR,
        `${el.offsetHeight + SCROLL_OFFSET_GAP_PX}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(SCROLL_OFFSET_VAR);
    };
  }, [active]);
  return ref;
}

export function ReportToolbar({
  contextControls,
  sticky = false,
  layoutKey,
}: ReportToolbarProps) {
  const ref = useStickyScrollOffset(sticky && contextControls !== undefined);
  if (contextControls === undefined) return null;
  const frameClass = sticky
    ? REPORT_TOOLBAR_FRAME_STICKY_CLASS
    : REPORT_TOOLBAR_FRAME_CLASS;
  return (
    <div
      ref={ref}
      data-testid="report-toolbar"
      data-layout-key={layoutKey}
      data-layout-stability={layoutKey ? "position-size" : undefined}
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
      className="flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:justify-end"
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
    <div className="flex min-w-0 max-w-full flex-col gap-y-0.5 md:flex-row md:items-baseline md:gap-x-2">
      <span className="min-w-0 text-sm text-[var(--color-muted-foreground)] [overflow-wrap:anywhere]">
        {label}
      </span>
      <span
        aria-hidden="true"
        className="hidden text-[var(--color-muted-foreground)] md:inline"
      >
        &middot;
      </span>
      <span className="text-sm text-[var(--color-muted-foreground)] md:whitespace-nowrap">
        {detail}
      </span>
    </div>
  );
}
