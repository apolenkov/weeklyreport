"use client";

import type { ReactNode } from "react";

interface BoardEmptyStateProps {
  readonly readOnly: boolean;
  readonly readOnlyLabel: string;
  readonly editableLabel: string;
  readonly addButton: ReactNode;
}

// Stand-alone "+ Add" — empty boards have no per-column headers to hang it on.
export function BoardEmptyState({
  readOnly,
  readOnlyLabel,
  editableLabel,
  addButton,
}: BoardEmptyStateProps) {
  if (readOnly) {
    return (
      <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
        {readOnlyLabel}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-8 text-center">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {editableLabel}
      </p>
      {addButton}
    </div>
  );
}
