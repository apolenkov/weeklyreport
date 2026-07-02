"use client";

import { Archive } from "lucide-react";

import { ToolbarIconButton } from "./toolbar-icon-button";

const ARCHIVE_TOGGLE_LABEL = "Show closed (archived) report periods";

// head-toolbar-parity D4: compact icon button, but the switch semantics and
// the checked visual state carry over from the old text pill unchanged.
const CHECKED_CLASS =
  "cursor-pointer border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-starbucks-accent)]";
const UNCHECKED_CLASS =
  "cursor-pointer border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)]";

interface ArchiveToggleProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

/**
 * Toolbar switch that folds archived (closed) report periods into the period
 * list. Rendered as a shared token-sized ToolbarIconButton
 * while keeping `role="switch"` + `aria-checked`. The control is a quiet inert
 * state indicator only — it carries no numeric count badge, which read as a
 * "press me" call-to-action rather than a switch.
 */
export function ArchiveToggle({ checked, onChange }: ArchiveToggleProps) {
  return (
    <ToolbarIconButton
      role="switch"
      aria-checked={checked}
      aria-label={ARCHIVE_TOGGLE_LABEL}
      onClick={() => onChange(!checked)}
      className={checked ? CHECKED_CLASS : UNCHECKED_CLASS}
    >
      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
    </ToolbarIconButton>
  );
}
