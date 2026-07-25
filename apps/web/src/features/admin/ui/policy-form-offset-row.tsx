import type { PolicyFormState } from "../model/reminders-form-state";
import {
  getOffsetAmount,
  getOffsetUnit,
  type OffsetUnit,
  offsetUnitFactor,
} from "../model/reminders-tab-format";
import {
  POLICY_FORM_INPUT_CLASS,
  POLICY_FORM_LABEL_CLASS,
} from "./policy-form-styles";

// Blank / negative / non-numeric input reads as 0 so the stored offset can
// never become NaN minutes.
function parseOffsetMagnitude(raw: string): number {
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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
}

function OffsetAmountInput({
  magnitude,
  unit,
  beforeDeadline,
  applyOffset,
}: OffsetControlProps) {
  return (
    <input
      id="policy-offset-minutes"
      type="number"
      min={0}
      value={magnitude}
      onChange={(e) =>
        applyOffset(parseOffsetMagnitude(e.target.value), unit, beforeDeadline)
      }
      aria-label="reminder offset amount"
      className={POLICY_FORM_INPUT_CLASS}
    />
  );
}

function OffsetUnitSelect({
  magnitude,
  unit,
  beforeDeadline,
  applyOffset,
}: OffsetControlProps) {
  return (
    <select
      aria-label="reminder offset unit"
      value={unit}
      onChange={(e) =>
        applyOffset(magnitude, e.target.value as OffsetUnit, beforeDeadline)
      }
      className={POLICY_FORM_INPUT_CLASS}
    >
      <option value="minutes">minutes</option>
      <option value="hours">hours</option>
      <option value="days">days</option>
    </select>
  );
}

function OffsetDirectionSelect({
  magnitude,
  unit,
  beforeDeadline,
  applyOffset,
}: OffsetControlProps) {
  return (
    <select
      aria-label="before or after deadline"
      value={beforeDeadline ? "before" : "after"}
      onChange={(e) =>
        applyOffset(magnitude, unit, e.target.value === "before")
      }
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
}: {
  readonly form: PolicyFormState;
  readonly onChange: (
    next: PolicyFormState | ((prev: PolicyFormState) => PolicyFormState),
  ) => void;
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
  const controls = { magnitude, unit, beforeDeadline, applyOffset };

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
