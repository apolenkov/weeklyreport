"use client";

import { useEffect, useRef } from "react";

import type { PolicyFormState } from "../model/reminders-form-state";
import {
  CUSTOM_PRESET_LABEL,
  getOffsetAmount,
  getOffsetUnit,
  type OffsetUnit,
  offsetUnitFactor,
  presetPairing,
  REMINDER_PRESETS,
  type ReminderPreset,
} from "../model/reminders-tab-format";
import { PolicyFormAdvancedFields } from "./policy-form-advanced-fields";
import {
  POLICY_FORM_INPUT_CLASS,
  POLICY_FORM_LABEL_CLASS,
} from "./policy-form-styles";

interface PolicyFormProps {
  readonly form: PolicyFormState;
  readonly editing: boolean;
  readonly isSaving: boolean;
  readonly validityValid: boolean;
  readonly onChange: (
    next: PolicyFormState | ((prev: PolicyFormState) => PolicyFormState),
  ) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}

// Every field block edits the same draft through the same updater, so each one
// takes the draft plus the updater rather than a bespoke prop list.
type PolicyFieldProps = Pick<PolicyFormProps, "form" | "onChange">;

function ReminderTypeField({ form, onChange }: PolicyFieldProps) {
  function selectPreset(preset: ReminderPreset) {
    const { kind, audience } = presetPairing(preset);
    onChange((prev) => ({ ...prev, preset, kind, audience }));
  }

  return (
    <div className="md:col-span-2">
      <label htmlFor="policy-type" className={POLICY_FORM_LABEL_CLASS}>
        Reminder type
      </label>
      {form.preset === "custom" ? (
        // A legacy pairing outside the two presets is shown read-only
        // and its stored kind/audience are written back unchanged.
        <div
          id="policy-type"
          data-testid="policy-type-custom"
          className={`${POLICY_FORM_INPUT_CLASS} text-[var(--color-muted-foreground)]`}
        >
          {CUSTOM_PRESET_LABEL}
        </div>
      ) : (
        <select
          id="policy-type"
          value={form.preset}
          onChange={(e) => selectPreset(e.target.value as ReminderPreset)}
          className={POLICY_FORM_INPUT_CLASS}
        >
          {REMINDER_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

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

function ReminderOffsetRow({ form, onChange }: PolicyFieldProps) {
  // Offset shown to admins as a positive number + before/after toggle.
  const beforeDeadline = form.offsetMinutes <= 0;
  const unit = getOffsetUnit(form.offsetMinutes);
  const magnitude = getOffsetAmount(form.offsetMinutes, unit);

  const applyOffset = (amount: number, toUnit: OffsetUnit, before: boolean) =>
    onChange((prev) => ({
      ...prev,
      offsetMinutes: signedOffsetMinutes(amount, toUnit, before),
    }));

  return (
    <div className="min-w-0 md:col-span-2">
      <label
        htmlFor="policy-offset-minutes"
        className={POLICY_FORM_LABEL_CLASS}
      >
        Send
      </label>
      <div className="grid gap-2 sm:grid-cols-[88px_minmax(120px,1fr)_minmax(168px,1.2fr)]">
        <input
          id="policy-offset-minutes"
          type="number"
          min={0}
          value={magnitude}
          onChange={(e) =>
            applyOffset(
              parseOffsetMagnitude(e.target.value),
              unit,
              beforeDeadline,
            )
          }
          aria-label="reminder offset amount"
          className={POLICY_FORM_INPUT_CLASS}
        />
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
      </div>
    </div>
  );
}

type PolicyFormFooterProps = PolicyFieldProps &
  Pick<
    PolicyFormProps,
    "editing" | "isSaving" | "validityValid" | "onCancel" | "onSave"
  >;

function PolicyFormFooter({
  form,
  onChange,
  editing,
  isSaving,
  validityValid,
  onCancel,
  onSave,
}: PolicyFormFooterProps) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) =>
            onChange((prev) => ({ ...prev, active: e.target.checked }))
          }
        />
        <span>Active</span>
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {!validityValid && (
          <span
            data-testid="policy-validity-hint"
            className="text-xs text-[var(--color-destructive)]"
          >
            End date must be after start date
          </span>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !validityValid}
          data-testid="policy-save-button"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving…" : editing ? "Save changes" : "Create reminder"}
        </button>
      </div>
    </div>
  );
}

export function PolicyForm({
  form,
  editing,
  isSaving,
  validityValid,
  onChange,
  onCancel,
  onSave,
}: PolicyFormProps) {
  // Move focus into the editor when it opens inline so keyboard/screen-reader
  // users are taken to it instead of silently losing their place (the row's
  // Edit button unmounts). The labelled group announces what just appeared.
  const regionRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    regionRef.current?.focus();
  }, []);

  return (
    <div
      ref={regionRef}
      tabIndex={-1}
      role="group"
      aria-label={editing ? "Edit reminder" : "New reminder"}
      data-testid="policy-form"
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] p-4 focus:outline-none"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ReminderTypeField form={form} onChange={onChange} />
        <ReminderOffsetRow form={form} onChange={onChange} />
      </div>

      <PolicyFormAdvancedFields form={form} onChange={onChange} />

      <PolicyFormFooter
        form={form}
        onChange={onChange}
        editing={editing}
        isSaving={isSaving}
        validityValid={validityValid}
        onCancel={onCancel}
        onSave={onSave}
      />
    </div>
  );
}
