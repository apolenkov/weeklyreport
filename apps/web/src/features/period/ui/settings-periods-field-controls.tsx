"use client";

import type { AppSettings } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  type IntegerBounds,
  parseIntegerInBounds,
} from "./settings-periods-fields-base-helpers";

const NUMBER_INPUT_CLASS =
  "w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";
const NUMBER_INPUT_ERROR_CLASS = `${NUMBER_INPUT_CLASS} border-[var(--color-destructive)]`;
const FIELD_LABEL_CLASS =
  "mb-1 block text-sm font-medium text-[var(--color-foreground)]";
const FIELD_HINT_CLASS = "mt-1 text-xs text-[var(--color-muted-foreground)]";
const FIELD_ERROR_CLASS = "mt-1 text-xs text-[var(--color-destructive)]";
const TOGGLE_CARD_CLASS =
  "flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm text-[var(--color-foreground)]";

interface NumberFieldStateArgs {
  readonly id: string;
  readonly bounds: IntegerBounds;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly onValidityChange?: (id: string, valid: boolean) => void;
}

function useNumberFieldState(args: NumberFieldStateArgs) {
  const [raw, setRaw] = useState(() => String(args.value));
  const [error, setError] = useState<string | null>(null);
  const [committedValue, setCommittedValue] = useState(args.value);
  if (committedValue !== args.value) {
    setCommittedValue(args.value);
    setRaw(String(args.value));
    setError(null);
  }

  function handleChange(text: string) {
    setRaw(text);
    const parsed = parseIntegerInBounds(text, args.bounds);
    if (parsed === null) {
      setError(
        `Whole number between ${args.bounds.min} and ${args.bounds.max} required`,
      );
      args.onValidityChange?.(args.id, false);
      return;
    }
    setError(null);
    args.onValidityChange?.(args.id, true);
    args.onChange(parsed);
  }

  return { raw, error, handleChange };
}

// Keeps the raw draft text and commits only a parsed in-bounds integer; invalid
// input surfaces an inline error instead of silently becoming a fallback value
// (no-fallback policy). onValidityChange lets the parent gate Save on validity.
export function NumberField({
  id,
  label,
  bounds,
  value,
  onChange,
  hint,
  onValidityChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly bounds: IntegerBounds;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly hint: ReactNode;
  readonly onValidityChange?: (id: string, valid: boolean) => void;
}) {
  const { raw, error, handleChange } = useNumberFieldState({
    id,
    bounds,
    value,
    onChange,
    ...(onValidityChange === undefined ? {} : { onValidityChange }),
  });

  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        autoComplete="off"
        inputMode="numeric"
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        className={
          error === null ? NUMBER_INPUT_CLASS : NUMBER_INPUT_ERROR_CLASS
        }
      />
      <p id={`${id}-hint`} className={FIELD_HINT_CLASS}>
        {hint}
      </p>
      {error !== null && (
        <p id={`${id}-error`} className={FIELD_ERROR_CLASS} role="alert">
          {error}
        </p>
      )}
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
  readonly value: AppSettings["workingDays"];
  readonly onChange: (value: AppSettings["workingDays"]) => void;
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
