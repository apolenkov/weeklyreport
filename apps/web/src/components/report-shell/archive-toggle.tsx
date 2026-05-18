"use client";

import { Archive } from "lucide-react";

type ArchiveToggleProps = {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
};

export function ArchiveToggle({ checked, onChange }: ArchiveToggleProps) {
  return (
    <label
      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-2 text-[13px] font-semibold text-[var(--color-foreground)]"
      title="Show archived periods"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
        aria-label="Show archived periods"
      />
      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Show archived</span>
    </label>
  );
}
