import type { ReactNode } from "react";

// Chrome-only segmented track for report toolbar toggles. Soft slate active
// fill (not brand green — reserved for forward actions). Consumers supply
// their own segment elements (Link, radiogroup, aria-pressed buttons).

const TRACK_BASE =
  "inline-flex items-center gap-0.5 overflow-visible rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] p-0.5 max-md:min-h-[var(--touch-target-min)]";

// Two heights: "sm" is the shared toolbar control height (32px); "lg" matches
// the slide-hero status row (h-11) so the in-hero scope toggle lines up with
// the hero badges/capsule. Segments use `h-full`, so they fill either track.
const TRACK_HEIGHT = {
  sm: "h-[var(--toolbar-control-h)]",
  lg: "h-11",
} as const;

const ACTIVE_CLASS =
  "bg-[var(--color-toggle-active)] text-[var(--color-primary-foreground)]";
const INACTIVE_CLASS =
  "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]";
const MOBILE_TOUCH_TARGET_CLASS = "max-md:min-h-[var(--touch-target-min)]";
const MOBILE_ICON_TOUCH_TARGET_CLASS = "max-md:min-w-[var(--touch-target-min)]";

interface SegmentOptions {
  // Icon-only segment — square on desktop; mobile adds the shared touch floor.
  // Consumer must supply aria-label.
  readonly iconOnly?: boolean;
  readonly desktopLabels?: boolean;
}

export function segmentClassName(
  active: boolean,
  { iconOnly = false, desktopLabels = false }: SegmentOptions = {},
): string {
  const shape = desktopLabels
    ? "w-[calc(var(--toolbar-control-h)-0.25rem)] lg:w-auto lg:min-w-[68px] lg:px-2.5"
    : iconOnly
      ? "w-[calc(var(--toolbar-control-h)-0.25rem)]"
      : "min-w-[64px] px-3";
  return `inline-flex h-full items-center justify-center gap-1 rounded-[var(--radius-pill)] text-xs font-semibold transition-colors ${MOBILE_TOUCH_TARGET_CLASS} ${
    iconOnly ? MOBILE_ICON_TOUCH_TARGET_CLASS : ""
  } ${shape} ${active ? ACTIVE_CLASS : INACTIVE_CLASS}`;
}

interface SegmentedToggleProps {
  readonly role?: "radiogroup" | "group";
  readonly ariaLabel: string;
  readonly size?: "sm" | "lg";
  readonly children: ReactNode;
}

export function SegmentedToggle({
  role = "group",
  ariaLabel,
  size = "sm",
  children,
}: SegmentedToggleProps) {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={`${TRACK_BASE} ${TRACK_HEIGHT[size]}`}
    >
      {children}
    </div>
  );
}
