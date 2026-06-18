import type { ReactNode } from "react";

/**
 * Shared presentational primitive for the report toolbar's segmented toggles.
 *
 * One neutral, compact visual family for every segmented view-toggle
 * (Edit/Slides, Product/Leads, Mine/Everyone): a neutral-bordered track on a
 * solid `--color-surface-empty` surface, with the active segment filled with a
 * soft slate (`--color-toggle-active`, white text) — NOT the brand accent.
 * Brand green is reserved for the header-line forward actions (Submit Section,
 * Publish & Lock).
 *
 * Every control sits on the shared toolbar height (`--toolbar-control-h`, 32px)
 * so the toolbar reads as one row of equal-height controls.
 *
 * The primitive owns only the chrome. Each consumer supplies its own segment
 * element so its mechanics survive: `ViewModeToggle` renders `<Link>` URL
 * navigation, `ScopeToggle` a `radiogroup`, `RecordVisibilityToggle`
 * `aria-pressed` buttons.
 */

const TRACK_CLASS =
  "inline-flex h-[var(--toolbar-control-h)] items-center gap-0.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] p-0.5";

const ACTIVE_CLASS = "bg-[var(--color-toggle-active)] text-white";
const INACTIVE_CLASS =
  "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]";

interface SegmentOptions {
  /** Icon-only segment — square, no min-width. The consumer MUST supply an
   *  aria-label + title so the icon keeps an accessible name. */
  readonly iconOnly?: boolean;
}

/**
 * Class for one segment. `active` drives the slate fill; the rest is shared
 * shape (full track height, pill radius, compact `text-xs`). Text segments get
 * a comfortable min-width; icon-only segments are square.
 */
export function segmentClassName(
  active: boolean,
  { iconOnly = false }: SegmentOptions = {},
): string {
  const shape = iconOnly
    ? "w-[calc(var(--toolbar-control-h)-0.25rem)]"
    : "min-w-[64px] px-3";
  return `inline-flex h-full items-center justify-center gap-1 rounded-[var(--radius-pill)] text-xs font-semibold transition-colors ${shape} ${
    active ? ACTIVE_CLASS : INACTIVE_CLASS
  }`;
}

interface SegmentedToggleProps {
  /** Group semantics — `radiogroup` for single-select, `group` otherwise. */
  readonly role?: "radiogroup" | "group";
  readonly ariaLabel: string;
  readonly children: ReactNode;
}

/** The track wrapper. Children are segments using {@link segmentClassName}. */
export function SegmentedToggle({
  role = "group",
  ariaLabel,
  children,
}: SegmentedToggleProps) {
  return (
    <div role={role} aria-label={ariaLabel} className={TRACK_CLASS}>
      {children}
    </div>
  );
}
