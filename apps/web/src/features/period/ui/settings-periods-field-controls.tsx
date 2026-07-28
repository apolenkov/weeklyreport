"use client";

import type { ReactNode } from "react";

import type { AdminSettingsView } from "../../admin";
import * as fieldLimits from "./settings-periods-fields-base-helpers";

const NUMBER_INPUT_CLASS =
  "w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";
const FIELD_LABEL_CLASS =
  "mb-1 block text-sm font-medium text-[var(--color-foreground)]";
const FIELD_HINT_CLASS = "mt-1 text-xs text-[var(--color-muted-foreground)]";
const TOGGLE_CARD_CLASS =
  "flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]";

interface NumberFieldBounds {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
}

// Integer field clamped to its declared bounds on every keystroke, so the draft
// never holds a value the API would reject.
export function NumberField({
  id,
  label,
  bounds,
  value,
  onChange,
  hint,
}: {
  readonly id: string;
  readonly label: string;
  readonly bounds: NumberFieldBounds;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly hint: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="numeric"
        min={bounds.min}
        max={bounds.max}
        value={value}
        onChange={(e) =>
          onChange(fieldLimits.boundedInteger(e.target.value, bounds))
        }
        className={NUMBER_INPUT_CLASS}
      />
      <p className={FIELD_HINT_CLASS}>{hint}</p>
    </div>
  );
}

// Checkbox card: the whole card is the label, so the description is clickable.
export function ToggleField({
  name,
  title,
  description,
  checked,
  onChange,
}: {
  readonly name: string;
  readonly title: string;
  readonly description: ReactNode;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className={TOGGLE_CARD_CLASS}>
      <input
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
      />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-[var(--color-muted-foreground)]">
          {description}
        </span>
      </span>
    </label>
  );
}

const WORKING_DAY_OPTIONS = [
  { value: "mon-fri", label: "Mon-Fri (5-day week)" },
  { value: "mon-sat", label: "Mon-Sat (6-day week)" },
  { value: "mon-sun", label: "Mon-Sun (7-day week)" },
] as const;

export function WorkingDaysField({
  value,
  onChange,
}: {
  readonly value: AdminSettingsView["workingDays"];
  readonly onChange: (value: AdminSettingsView["workingDays"]) => void;
}) {
  return (
    <fieldset>
      <legend className={FIELD_LABEL_CLASS}>Working days</legend>
      <div className="flex flex-col gap-2">
        {WORKING_DAY_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 text-sm text-[var(--color-foreground)]"
          >
            <input
              type="radio"
              name="working-days"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      <p className={FIELD_HINT_CLASS}>
        Feeds the deadline (business-day) calculation used when periods are
        created.
      </p>
    </fieldset>
  );
}
