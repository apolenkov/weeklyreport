"use client";

import type { CreateSeed } from "../../../hooks/use-editable-list-dialog";
import type { ItemColumn } from "../model/next-week-columns";

interface BoardColumnHeaderProps {
  readonly col: ItemColumn;
  readonly readOnly: boolean;
  /**
   * Multi-product gate for PRODUCT columns: with a single product the
   * section-level "+ Add Item" button already targets it, so the per-column
   * button would duplicate it. Activity lanes ignore the gate — the activity
   * is never that single default parent.
   */
  readonly showProductAdd: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
}

/**
 * Column header shared by the Current/Next week boards: the column label plus
 * a "+ Add" button that opens the item dialog with the column's parent
 * preselected — the activity on an activity lane, the product on a product
 * column.
 */
export function BoardColumnHeader({
  col,
  readOnly,
  showProductAdd,
  onAdd,
}: BoardColumnHeaderProps) {
  const showAdd = !readOnly && (col.activityId != null || showProductAdd);
  return (
    <div className="mb-3 flex min-w-0 items-center gap-2">
      {/* gap-2 (not justify-between) keeps the `+ Add` button glued next to
          the label so the header reads as a tight unit even when the column
          is wide. */}
      <div className="min-w-0 flex-1 truncate font-[family-name:var(--font-sans)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
        {col.productName}
      </div>
      {showAdd && (
        <button
          type="button"
          // Mobile keeps the 44px tap-target for a11y; md+ compacts to 28px.
          className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[28px] flex-shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.18)] bg-[rgba(0,117,74,0.08)] px-3 py-1.5 md:px-2.5 md:py-0.5 text-[11px] font-semibold text-[var(--color-primary)] transition-colors hover:border-[rgba(0,117,74,0.28)] hover:bg-[var(--color-success)]"
          onClick={() =>
            onAdd(
              col.activityId != null
                ? { activityId: col.activityId }
                : { productId: col.productId },
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
