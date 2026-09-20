"use client";

import type {
  ParentActivityOption,
  RecordParent,
} from "../model/record-parent";
import type { Product } from "../model/types";

type ResolvedRecordParentKind = Exclude<RecordParent["kind"], "unresolved">;

interface ParentPickerProps {
  readonly id: string;
  readonly value: RecordParent;
  readonly error?: string | undefined;
  readonly products: readonly Product[];
  // kind drives stage required (product) vs forbidden (activity). Omit for product-only.
  readonly activities?: readonly ParentActivityOption[];
  readonly onChange: (parent: RecordParent) => void;
}

const OPTION_SEP = ":";
const UNRESOLVED_VALUE = "unresolved:";

function encodeParent(parent: RecordParent): string {
  return parent.kind === "unresolved"
    ? UNRESOLVED_VALUE
    : `${parent.kind}${OPTION_SEP}${parent.id}`;
}

function decodeParent(
  raw: string,
  products: readonly Product[],
  activities: readonly ParentActivityOption[],
): RecordParent {
  if (raw === UNRESOLVED_VALUE) return { kind: "unresolved" };
  const sep = raw.indexOf(OPTION_SEP);
  if (sep === -1) return { kind: "unresolved" };
  const kind = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  // The value only means a parent when its id actually exists in the option
  // list — anything else is an explicit absence, never a coerced product.
  if (kind === "product" && products.some((p) => p.id === id)) {
    return { kind: "product", id };
  }
  if (kind === "activity" && activities.some((a) => a.id === id)) {
    return { kind: "activity", id };
  }
  return { kind: "unresolved" };
}

// Option values carry the parent kind so the XOR survives the round trip
// through the DOM's string-only value.
function ParentOptionGroup({
  label,
  kind,
  options,
}: {
  readonly label: string;
  readonly kind: ResolvedRecordParentKind;
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

export function ParentPicker({
  id,
  value,
  error,
  products,
  activities = [],
  onChange,
}: ParentPickerProps) {
  const hasActivities = activities.length > 0;
  const label = hasActivities ? "Parent" : "Product";
  const totalOptions = products.length + activities.length;
  // An unresolved parent with options must stay selectable so the user can
  // resolve it; an empty picker is disabled, and a resolved sole option is
  // locked (no alternative to switch to).
  const isUnresolved = value.kind === "unresolved";

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
        className={`select-chevron w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border bg-[var(--color-card)] py-2.5 pl-3 text-sm text-[var(--color-foreground)] focus:outline-none ${error ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[var(--shadow-focus-destructive)]" : "border-[var(--color-border-strong)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_var(--color-ring)]"}`}
        value={encodeParent(value)}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) =>
          onChange(decodeParent(e.target.value, products, activities))
        }
        disabled={totalOptions === 0 || (!isUnresolved && totalOptions <= 1)}
      >
        {isUnresolved && (
          <option value={UNRESOLVED_VALUE} disabled>
            Select parent…
          </option>
        )}
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
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-xs text-[var(--color-destructive)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
