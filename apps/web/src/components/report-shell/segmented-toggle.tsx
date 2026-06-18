import type { ReactNode } from "react";

/**
 * Shared presentational primitive for the report toolbar's segmented toggles.
 *
 * One neutral visual family for every segmented view-toggle (Edit/Slides,
 * Product/Leads, Mine/Everyone): a neutral-bordered track on a solid
 * `--color-surface-empty` surface, with the active segment filled with the
 * neutral foreground (white text) — NOT the brand accent. Brand green is
 * reserved for header-line forward actions (Submit Section, Publish & Lock).
 *
 * The primitive owns only the chrome (track + per-segment classes). Each
 * consumer supplies its own segment element so its mechanics survive:
 * `ViewModeToggle` renders `<Link>` URL navigation, `ScopeToggle` renders a
 * `radiogroup`, `RecordVisibilityToggle` renders `aria-pressed` buttons.
 */

// One shared per-segment minimum width so the toggles align and the active
// highlight does not change width as the selection moves.
const SEGMENT_MIN_WIDTH = "min-w-[92px]";

// The track wraps the segments into one pill. `inline-flex` + the solid
// `--color-surface-empty` surface means an inactive segment never shows the
// toolbar frame through it (the old `--color-surface` was undefined and let the
// cream frame tint the segment yellow).
const TRACK_CLASS =
  "inline-flex items-center gap-0.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] p-0.5";

const ACTIVE_CLASS = "bg-[var(--color-foreground)] text-white";
const INACTIVE_CLASS =
  "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]";

/**
 * Class for one segment. `active` drives the neutral fill; the rest is shared
 * shape (touch-target height, equal min-width, pill radius, type tier).
 */
export function segmentClassName(active: boolean): string {
  return `${SEGMENT_MIN_WIDTH} inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-1 rounded-[var(--radius-pill)] px-3 text-sm font-semibold transition-colors ${
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
