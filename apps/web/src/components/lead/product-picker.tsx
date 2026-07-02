"use client";

import type { Product } from "./mock-data";

interface ProductPickerProps {
  /** Unique id so the label/select pair stays accessible per dialog. */
  readonly id: string;
  /** Currently selected product id. */
  readonly value: string;
  /** Products the lead can scope the record to. */
  readonly products: readonly Product[];
  /** Called with the newly selected product id. */
  readonly onChange: (productId: string) => void;
}

/**
 * unify-record-dialogs: the one Product picker shared by the Item, Risk, and
 * Decision dialogs (the stages list was already shared via `StageMultiSelect`).
 * Always renders so the three dialogs read identically; it is disabled when
 * there is a single product (no choice to make).
 */
export function ProductPicker({
  id,
  value,
  products,
  onChange,
}: ProductPickerProps) {
  return (
    <div>
      <label
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
        htmlFor={id}
      >
        Product
      </label>
      <select
        id={id}
        className="select-chevron w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border border-[rgba(0,0,0,0.2)] bg-white py-2.5 pl-3 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={products.length <= 1}
      >
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
