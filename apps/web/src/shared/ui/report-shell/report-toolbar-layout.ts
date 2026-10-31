// Layout class constants only, with no hooks, so server components can import them.
export const REPORT_TOOLBAR_FRAME_BASE_CLASS =
  "rounded-[var(--radius)] border border-[var(--color-border-subtle)] px-2 py-1.5";

// Sticky opt-in: opaque surface (no /70), shadow, z-20 under NavBar dropdowns
// (z-30). Both variants share the same frame dimensions and border.
export const REPORT_TOOLBAR_FRAME_STICKY_CLASS = `${REPORT_TOOLBAR_FRAME_BASE_CLASS} bg-[var(--color-surface-hover)] md:sticky md:top-0 md:z-20 md:shadow-md`;

// Context controls wrap at narrow widths so every action remains visible and
// keyboard-reachable without creating a second horizontal scroll surface.
export const REPORT_TOOLBAR_ROW_CLASS =
  "flex min-w-0 flex-wrap items-center gap-1.5 md:flex-nowrap";
