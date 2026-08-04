"use client";

import type { Product } from "../../report-sections";

interface AddItemButtonProps {
  readonly defaultProduct: Product | undefined;
  readonly onAdd: (productId: string) => void;
}

// Disabled when no assigned product can seed the create dialog.
export function AddItemButton({ defaultProduct, onAdd }: AddItemButtonProps) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => defaultProduct && onAdd(defaultProduct.id)}
        disabled={!defaultProduct}
        title={
          defaultProduct
            ? `Add item to ${defaultProduct.name}`
            : "No products assigned — contact admin"
        }
      >
        + Add Item
      </button>
    </div>
  );
}
