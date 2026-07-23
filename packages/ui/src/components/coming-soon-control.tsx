import { ComingSoonTooltip } from "@customreport/ui/components/ui/tooltip";
import { cn } from "@customreport/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

/*
 * Single source of the inert "coming soon" button chrome: the ComingSoonTooltip
 * wrapper, the aria-disabled button, the shared inert classes, and a fixed-size
 * lucide icon slot. Every inert BUTTON deferred control composes this so their
 * parity holds by construction, not by per-file source scan. The primitive owns
 * all geometry classes per variant — consumers pass NO className.
 */

const INERT_CHROME =
  "inline-flex cursor-default items-center justify-center border border-[var(--color-border)] bg-[var(--color-surface-empty)] font-semibold text-[var(--color-muted-foreground)]";

const ICON_SHAPE = {
  toolbar:
    "h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] shrink-0 rounded-full",
  nav: "h-8 w-10 rounded-[var(--radius-pill)] px-0",
} as const;

// Icon-only inert control. `shape` picks the toolbar square or the nav pill.
export function ComingSoonIconButton({
  icon: Icon,
  ariaLabel,
  testId,
  shape,
}: {
  readonly icon: LucideIcon;
  readonly ariaLabel: string;
  readonly testId: string;
  readonly shape: "toolbar" | "nav";
}) {
  return (
    <ComingSoonTooltip>
      <button
        type="button"
        aria-disabled="true"
        aria-label={ariaLabel}
        data-testid={testId}
        className={cn(INERT_CHROME, ICON_SHAPE[shape])}
      >
        <Icon size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </ComingSoonTooltip>
  );
}

// Labelled inert control. `compact` strips the touch-target min-height.
export function ComingSoonControl({
  icon: Icon,
  ariaLabel,
  testId,
  label,
  compact = false,
}: {
  readonly icon: LucideIcon;
  readonly ariaLabel: string;
  readonly testId: string;
  readonly label: string;
  readonly compact?: boolean;
}) {
  return (
    <ComingSoonTooltip>
      <button
        type="button"
        aria-disabled="true"
        aria-label={ariaLabel}
        data-testid={testId}
        className={cn(
          INERT_CHROME,
          "gap-1.5 rounded-[var(--radius-pill)]",
          compact
            ? "h-[var(--toolbar-control-h)] px-2.5 text-xs"
            : "min-h-[var(--touch-target-min)] px-4 py-1.5 text-sm",
        )}
      >
        <Icon size={14} strokeWidth={2} aria-hidden="true" />
        <span>{label}</span>
      </button>
    </ComingSoonTooltip>
  );
}
