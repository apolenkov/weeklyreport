import { useState } from "react";

import type { PolicyFormState } from "../../model/reminders-form-state";
import {
  getOffsetAmount,
  getOffsetUnit,
  OFFSET_UNITS,
  type OffsetUnit,
  offsetUnitFactor,
} from "../../model/reminders-tab-format";
import {
  POLICY_FORM_INPUT_CLASS,
  POLICY_FORM_LABEL_CLASS,
} from "./policy-form-styles";

// Strict parse: blank, negative, or non-numeric text yields null so the caller
// keeps the raw draft text and surfaces a validation error instead of silently
// storing a 0 offset (no-fallback policy).
function parseOffsetMagnitude(raw: string): number | null {
  const text = raw.trim();
  if (text === "") return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

// Stored offset is signed minutes; "before deadline" is the negative side.
function signedOffsetMinutes(
  magnitude: number,
  unit: OffsetUnit,
  beforeDeadline: boolean,
): number {
  const minutes = magnitude * offsetUnitFactor(unit);
  return beforeDeadline ? -minutes : minutes;
}

// The three controls edit one signed offset together, so each receives the
// whole decoded offset plus the single writer that re-encodes it.
interface OffsetControlProps {
  readonly magnitude: number;
  readonly unit: OffsetUnit;
  readonly beforeDeadline: boolean;
  readonly applyOffset: (
    amount: number,
    unit: OffsetUnit,
    beforeDeadline: boolean,
  ) => void;
  readonly onValidityChange?: ((valid: boolean) => void) | undefined;
}

// Keeps the raw draft text and commits only a parsed non-negative magnitude;
// invalid input surfaces an inline error instead of silently becoming 0.
function OffsetAmountInput({
  magnitude,
  unit,
  beforeDeadline,
  applyOffset,
  onValidityChange,
}: OffsetControlProps) {
  const [raw, setRaw] = useState(() => String(magnitude));
  const [error, setError] = useState<string | null>(null);
  // Render-phase adjust: reseed raw text when the committed magnitude changes
  // externally (e.g. unit switch) without an effect.
  const [committedValue, setCommittedValue] = useState(magnitude);
  if (committedValue !== magnitude) {
    setCommittedValue(magnitude);
    setRaw(String(magnitude));
    setError(null);
  }

  function handleChange(text: string) {
    setRaw(text);
    const parsed = parseOffsetMagnitude(text);
    if (parsed === null) {
      setError("Enter a non-negative number");
      onValidityChange?.(false);
      return;
    }
    setError(null);
    onValidityChange?.(true);
    applyOffset(parsed, unit, beforeDeadline);
  }

  return (
    <div>
      <input
        id="policy-offset-minutes"
        type="number"
        min={0}
        aria-invalid={error !== null}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="reminder offset amount"
        className={POLICY_FORM_INPUT_CLASS}
      />
      {error !== null && (
        <p className="text-xs text-[var(--color-destructive)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function OffsetUnitSelect({
  magnitude,
  unit,
  beforeDeadline,
  applyOffset,
  onValidityChange,
}: OffsetControlProps) {
  return (
    <select
      aria-label="reminder offset unit"
      value={unit}
      onChange={(e) => {
        onValidityChange?.(true);
        // The option list and the union stay in lockstep via OFFSET_UNITS;
        // a value outside it is rejected rather than asserted.
        const nextUnit = (OFFSET_UNITS as readonly string[]).includes(
          e.target.value,
        )
          ? (e.target.value as OffsetUnit)
          : unit;
        applyOffset(magnitude, nextUnit, beforeDeadline);
      }}
      className={POLICY_FORM_INPUT_CLASS}
    >
      {OFFSET_UNITS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function OffsetDirectionSelect({
  magnitude,
  unit,
  beforeDeadline,
  applyOffset,
  onValidityChange,
}: OffsetControlProps) {
  return (
    <select
      aria-label="before or after deadline"
      value={beforeDeadline ? "before" : "after"}
      onChange={(e) => {
        onValidityChange?.(true);
        applyOffset(magnitude, unit, e.target.value === "before");
      }}
      className={POLICY_FORM_INPUT_CLASS}
    >
      <option value="before">before deadline</option>
      <option value="after">after deadline</option>
    </select>
  );
}

export function ReminderOffsetRow({
  form,
  onChange,
  onValidityChange,
}: {
  readonly form: PolicyFormState;
  readonly onChange: (
    next: PolicyFormState | ((prev: PolicyFormState) => PolicyFormState),
  ) => void;
  readonly onValidityChange?: (valid: boolean) => void;
}) {
  // Offset shown to admins as a positive number + before/after toggle.
  const beforeDeadline = form.offsetMinutes <= 0;
  const unit = getOffsetUnit(form.offsetMinutes);
  const magnitude = getOffsetAmount(form.offsetMinutes, unit);

  const applyOffset = (amount: number, toUnit: OffsetUnit, before: boolean) =>
    onChange((prev) => ({
      ...prev,
      offsetMinutes: signedOffsetMinutes(amount, toUnit, before),
    }));
  const controls = {
    magnitude,
    unit,
    beforeDeadline,
    applyOffset,
    onValidityChange,
  };

  return (
    <div className="min-w-0 md:col-span-2">
      <label
        htmlFor="policy-offset-minutes"
        className={POLICY_FORM_LABEL_CLASS}
      >
        Send
      </label>
      <div className="grid gap-2 sm:grid-cols-[88px_minmax(120px,1fr)_minmax(168px,1.2fr)]">
        <OffsetAmountInput {...controls} />
        <OffsetUnitSelect {...controls} />
        <OffsetDirectionSelect {...controls} />
      </div>
    </div>
  );
}
