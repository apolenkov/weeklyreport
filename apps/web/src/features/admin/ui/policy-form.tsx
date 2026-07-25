"use client";

import { useEffect, useRef } from "react";

import type { PolicyFormState } from "../model/reminders-form-state";
import {
  CUSTOM_PRESET_LABEL,
  presetPairing,
  REMINDER_PRESETS,
  type ReminderPreset,
} from "../model/reminders-tab-format";
import { PolicyFormAdvancedFields } from "./policy-form-advanced-fields";
import { PolicyFormFooter } from "./policy-form-footer";
import { ReminderOffsetRow } from "./policy-form-offset-row";
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

/**
 * Policy Form.
 * @param props - The props argument.
 */
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
