"use client";

import type { ReactNode } from "react";

interface BoardEmptyStateProps {
  readonly readOnly: boolean;
  /** Read-only copy, e.g. "No current-week items." */
  readonly readOnlyLabel: string;
  /** Editable copy, e.g. "No current-week items yet." */
  readonly editableLabel: string;
  /** The stand-alone "+ Add Item" CTA, seeded by the host section. */
  readonly addButton: ReactNode;
}

/**
 * The week boards' empty state, shared by Current/Next week: a dashed band with
 * a stand-alone "+ Add" CTA (there are no per-product columns to hang the
 * per-column button on when the board is empty). Read-only mode drops the CTA.
 */
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
