"use client";

import type { Product } from "./mock-data";

export type RecordParentKind = "product" | "activity";

/** The chosen parent of a record — a product OR an activity (XOR). */
export interface RecordParent {
  readonly id: string;
  readonly kind: RecordParentKind;
}

/** activity-first-class: one attached-activity option offered as a parent. */
export interface ParentActivityOption {
  readonly id: string;
  readonly name: string;
}

interface ParentPickerProps {
  /** Unique id so the label/select pair stays accessible per dialog. */
  readonly id: string;
  /** Currently selected parent (product or activity). */
  readonly value: RecordParent;
  /** Products the lead can scope the record to. */
  readonly products: readonly Product[];
  /**
   * activity-first-class: the section author's attached activities. When
   * non-empty the picker offers them in a second group; the chosen parent's
   * `kind` tells the host dialog whether a stage is required (product) or
   * forbidden (activity). Omit for a product-only picker (e.g. decisions).
   */
  readonly activities?: readonly ParentActivityOption[];
  /** Called with the newly selected parent. */
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

/**
 * unify-record-dialogs / activity-first-class: the one parent picker shared by
 * the Item and Risk dialogs. It offers the lead's products and — when passed —
 * the author's attached activities in a second group, returning the chosen
 * parent's id AND kind so the dialog can require a stage for a product and hide
 * the stage step for an activity. Disabled when there is a single parent (no
 * choice to make).
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
        <optgroup label="Products">
          {products.map((p) => (
            <option
              key={p.id}
              value={encodeParent({ kind: "product", id: p.id })}
            >
              {p.name}
            </option>
          ))}
        </optgroup>
        {hasActivities && (
          <optgroup label="Activities">
            {activities.map((a) => (
              <option
                key={a.id}
                value={encodeParent({ kind: "activity", id: a.id })}
              >
                {a.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
