"use client";

import { Maximize2, Minimize2 } from "lucide-react";

type ToggleAllButtonProps = {
  readonly action: "collapse" | "expand";
  readonly onToggle: () => void;
};

export function ToggleAllButton({ action, onToggle }: ToggleAllButtonProps) {
  const label = action === "collapse" ? "Collapse all" : "Expand all";
  const Icon = action === "collapse" ? Minimize2 : Maximize2;

  return (
    <button
      type="button"
      className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
      onClick={onToggle}
      title={label + " dashboard sections"}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
