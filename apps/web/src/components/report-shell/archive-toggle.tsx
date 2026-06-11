"use client";

import { Archive } from "lucide-react";

import { ToolbarIconButton } from "./toolbar-icon-button";

const ARCHIVE_TOGGLE_LABEL = "Show closed (archived) report periods";

// head-toolbar-parity D4: compact icon button, but the switch semantics and
// the checked visual state carry over from the old text pill unchanged.
const CHECKED_CLASS =
  "relative cursor-pointer border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-starbucks-accent)]";
const UNCHECKED_CLASS =
  "relative cursor-pointer border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)]";

interface ArchiveToggleProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly archivedCount?: number;
}

/**
 * Toolbar switch that folds archived (closed) report periods into the period
 * list. Rendered as a shared 32px ToolbarIconButton (head-toolbar-parity D4)
 * while keeping `role="switch"` + `aria-checked`. A non-zero archived count
 * is data the user acts on, so it stays visible as a numeric badge on the
 * control — never tooltip-only.
 */
export function ArchiveToggle({
  checked,
  onChange,
  archivedCount,
}: ArchiveToggleProps) {
  const showCount = archivedCount !== undefined && archivedCount > 0;
  return (
    <ToolbarIconButton
      role="switch"
      aria-checked={checked}
      aria-label={ARCHIVE_TOGGLE_LABEL}
      onClick={() => onChange(!checked)}
      className={checked ? CHECKED_CLASS : UNCHECKED_CLASS}
    >
      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
      {showCount && (
        <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-starbucks-accent)] px-1 text-[9px] font-semibold text-white tabular-nums">
          {archivedCount}
        </span>
      )}
    </ToolbarIconButton>
  );
}
