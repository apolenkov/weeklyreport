"use client";

import type { CreateSeed } from "../../../shared/hooks/dialogs/editable-list-dialog.types";
import type { ItemColumn } from "../model/next-week-columns";

interface BoardColumnHeaderProps {
  readonly col: ItemColumn;
  readonly readOnly: boolean;
  // PRODUCT columns: hide per-column Add when the section-level button already
  // targets the sole product. Activity lanes always show Add (activity ≠ default parent).
  readonly showProductAdd: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
}

export function BoardColumnHeader({
  col,
  readOnly,
  showProductAdd,
  onAdd,
}: BoardColumnHeaderProps) {
  const showAdd =
    !readOnly && (col.parent.kind === "activity" || showProductAdd);
  return (
    <div className="mb-3 flex min-w-0 items-center gap-2">
      {/* The label consumes remaining width; gap-2 keeps minimum separation
          from the fixed-size Add button. */}
      <div className="min-w-0 flex-1 truncate font-[family-name:var(--font-sans)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
        {col.productName}
      </div>
      {showAdd && (
        <button
          type="button"
          // Mobile keeps the 44px tap-target for a11y; md+ compacts to 28px.
          className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[28px] flex-shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[color-mix(in_srgb,var(--color-starbucks-accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-starbucks-accent)_8%,transparent)] px-3 py-1.5 md:px-2.5 md:py-0.5 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:border-[color-mix(in_srgb,var(--color-starbucks-accent)_28%,transparent)] hover:bg-[var(--color-success)]"
          onClick={() =>
            onAdd(
              col.parent.kind === "activity"
                ? { activityId: col.parent.id }
                : { productId: col.parent.id },
            )
          }
          aria-label={`Add item to ${col.productName}`}
        >
          + Add
        </button>
      )}
    </div>
  );
}
