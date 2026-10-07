"use client";

import { useEffect, useRef } from "react";

import type { PolicyFormState } from "../../model/reminders-form-state";
import {
  presetPairing,
  REMINDER_PRESETS,
  type ReminderPreset,
} from "../../model/reminders-tab-format";
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
  // Why Save is blocked; optional because the shared editor-props bundle type
  // predates it — the footer hint degrades to no text while Save stays gated.
  readonly validityReason?: string | null;
  readonly onChange: (
    next: PolicyFormState | ((prev: PolicyFormState) => PolicyFormState),
  ) => void;
  readonly onOffsetValidityChange: (valid: boolean) => void;
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
      <select
        id="policy-type"
        name="reminder-type"
        autoComplete="off"
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
    </div>
  );
}

export function PolicyForm({
  form,
  editing,
  isSaving,
  validityValid,
  validityReason,
  onChange,
  onOffsetValidityChange,
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
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      <fieldset disabled={isSaving} className="m-0 min-w-0 border-0 p-0">
        <div className="grid gap-4 md:grid-cols-2">
          <ReminderTypeField form={form} onChange={onChange} />
          <ReminderOffsetRow
            form={form}
            onChange={onChange}
            onValidityChange={onOffsetValidityChange}
          />
        </div>

        <PolicyFormAdvancedFields form={form} onChange={onChange} />

        <PolicyFormFooter
          form={form}
          onChange={onChange}
          editing={editing}
          isSaving={isSaving}
          validityValid={validityValid}
          validityReason={validityReason}
          onCancel={onCancel}
          onSave={onSave}
        />
      </fieldset>
    </div>
  );
}
