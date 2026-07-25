"use client";

import { Archive } from "lucide-react";

import { ToolbarIconButton } from "./toolbar-icon-button";

const ARCHIVE_TOGGLE_LABEL = "Show closed (archived) report periods";

const CHECKED_CLASS =
  "cursor-pointer border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-starbucks-accent)]";
const UNCHECKED_CLASS =
  "cursor-pointer border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)]";

interface ArchiveToggleProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

// No count badge — a number read as a call-to-action rather than a switch.
/**
 * Archive Toggle.
 * @param props - The props argument.
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
