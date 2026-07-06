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

const INPUT_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm";
const LABEL_CLASS =
  "mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]";

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

  // Offset shown to admins as a positive number + before/after toggle.
  const offsetIsBeforeDeadline = form.offsetMinutes <= 0;
  const offsetUnit = getOffsetUnit(form.offsetMinutes);
  const offsetMagnitude = getOffsetAmount(form.offsetMinutes, offsetUnit);

  function applyOffset(
    magnitude: number,
    unit: OffsetUnit,
    beforeDeadline: boolean,
  ) {
    const nextMinutes = magnitude * offsetUnitFactor(unit);
    onChange((prev) => ({
      ...prev,
      offsetMinutes: beforeDeadline ? -nextMinutes : nextMinutes,
    }));
  }

  function selectPreset(preset: ReminderPreset) {
    const { kind, audience } = presetPairing(preset);
    onChange((prev) => ({ ...prev, preset, kind, audience }));
  }

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
        <div className="md:col-span-2">
          <label htmlFor="policy-type" className={LABEL_CLASS}>
            Reminder type
          </label>
          {form.preset === "custom" ? (
            // D3: a legacy pairing outside the two presets is shown read-only
            // and its stored kind/audience are written back unchanged.
            <div
              id="policy-type"
              data-testid="policy-type-custom"
              className={`${INPUT_CLASS} text-[var(--color-muted-foreground)]`}
            >
              {CUSTOM_PRESET_LABEL}
            </div>
          ) : (
            <select
              id="policy-type"
              value={form.preset}
              onChange={(e) => selectPreset(e.target.value as ReminderPreset)}
              className={INPUT_CLASS}
            >
              {REMINDER_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="min-w-0 md:col-span-2">
          <label htmlFor="policy-offset-minutes" className={LABEL_CLASS}>
            Send
          </label>
          <div className="grid gap-2 sm:grid-cols-[88px_minmax(120px,1fr)_minmax(168px,1.2fr)]">
            <input
              id="policy-offset-minutes"
              type="number"
              min={0}
              value={offsetMagnitude}
              onChange={(e) => {
                const raw = Number.parseFloat(e.target.value);
                const magnitude = Number.isFinite(raw) && raw >= 0 ? raw : 0;
                applyOffset(magnitude, offsetUnit, offsetIsBeforeDeadline);
              }}
              aria-label="reminder offset amount"
              className={INPUT_CLASS}
            />
            <select
              aria-label="reminder offset unit"
              value={offsetUnit}
              onChange={(e) =>
                applyOffset(
                  offsetMagnitude,
                  e.target.value as OffsetUnit,
                  offsetIsBeforeDeadline,
                )
              }
              className={INPUT_CLASS}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
            <select
              aria-label="before or after deadline"
              value={offsetIsBeforeDeadline ? "before" : "after"}
              onChange={(e) =>
                applyOffset(
                  offsetMagnitude,
                  offsetUnit,
                  e.target.value === "before",
                )
              }
              className={INPUT_CLASS}
            >
              <option value="before">before deadline</option>
              <option value="after">after deadline</option>
            </select>
          </div>
        </div>
      </div>

      <PolicyFormAdvancedFields form={form} onChange={onChange} />

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
            {isSaving
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
