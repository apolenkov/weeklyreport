import { ComingSoonTooltip } from "@customreport/ui/components/ui/tooltip";
import { cn } from "@customreport/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

// Parity by construction for inert deferred controls; primitive owns geometry — no consumer className.

const INERT_CHROME =
  "inline-flex cursor-default items-center justify-center border border-[var(--color-border)] bg-[var(--color-surface-empty)] font-semibold text-[var(--color-muted-foreground)]";

const ICON_SHAPE = {
  toolbar:
    "h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] shrink-0 rounded-full",
  nav: "h-8 w-10 rounded-[var(--radius-pill)] px-0",
} as const;

/**
 * Inert deferred icon control with ComingSoon tooltip; primitive owns geometry (no className).
 * `shape` selects toolbar square vs nav pill dimensions.
 */
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

/**
 * Inert labelled deferred control with ComingSoon tooltip; primitive owns geometry (no className).
 * `compact` strips the touch-target min-height for denser toolbars.
 */
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
