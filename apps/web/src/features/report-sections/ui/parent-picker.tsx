"use client";

import type { Product } from "../model/types";

type RecordParentKind = "product" | "activity";

// XOR: a record parents to either a product or an activity, never both.
export interface RecordParent {
  readonly id: string;
  readonly kind: RecordParentKind;
}

export interface ParentActivityOption {
  readonly id: string;
  readonly name: string;
}

interface ParentPickerProps {
  readonly id: string;
  readonly value: RecordParent;
  readonly products: readonly Product[];
  // kind drives stage required (product) vs forbidden (activity). Omit for product-only.
  readonly activities?: readonly ParentActivityOption[];
  readonly onChange: (parent: RecordParent) => void;
}

const OPTION_SEP = ":";

function encodeParent(parent: RecordParent): string {
  return `${parent.kind}${OPTION_SEP}${parent.id}`;
}

function decodeParent(raw: string): RecordParent {
  const sep = raw.indexOf(OPTION_SEP);
  const kind = raw.slice(0, sep);
  return {
    kind: kind === "activity" ? "activity" : "product",
    id: raw.slice(sep + 1),
  };
}

// Option values carry the parent kind so the XOR survives the round trip
// through the DOM's string-only value.
function ParentOptionGroup({
  label,
  kind,
  options,
}: {
  readonly label: string;
  readonly kind: RecordParentKind;
  readonly options: readonly { readonly id: string; readonly name: string }[];
}) {
  return (
    <optgroup label={label}>
      {options.map((option) => (
        <option key={option.id} value={encodeParent({ kind, id: option.id })}>
          {option.name}
        </option>
      ))}
    </optgroup>
  );
}

/**
 * Parent Picker.
 * @param props - The props argument.
 */
export function ParentPicker({
  id,
  value,
  products,
  activities = [],
  onChange,
}: ParentPickerProps) {
  const hasActivities = activities.length > 0;
  const label = hasActivities ? "Parent" : "Product";
  const totalOptions = products.length + activities.length;

  return (
    <div>
      <label
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
        htmlFor={id}
      >
        {label}
      </label>
      <select
        id={id}
        className="select-chevron w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border border-[rgba(0,0,0,0.2)] bg-white py-2.5 pl-3 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
        value={encodeParent(value)}
        onChange={(e) => onChange(decodeParent(e.target.value))}
        disabled={totalOptions <= 1}
      >
        {products.length > 0 && (
          <ParentOptionGroup
            label="Products"
            kind="product"
            options={products}
          />
        )}
        {hasActivities && (
          <ParentOptionGroup
            label="Activities"
            kind="activity"
            options={activities}
          />
        )}
      </select>
    </div>
  );
}
