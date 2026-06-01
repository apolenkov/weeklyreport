"use client";

import { Archive } from "lucide-react";

interface ArchiveToggleProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

export function ArchiveToggle({ checked, onChange }: ArchiveToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Show closed (archived) report periods"
      title="Show closed (archived) report periods"
      onClick={() => onChange(!checked)}
      className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] border px-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] ${
        checked
          ? "border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-starbucks-accent)]"
          : "border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)]"
      }`}
    >
      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="hidden xl:inline">Show archived</span>
    </button>
  );
}
