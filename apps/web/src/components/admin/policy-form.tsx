"use client";

import type { MockReminderPolicy } from "./mock-data";
import type { PolicyFormState } from "./reminders-form-state";
import {
  AUDIENCE_OPTIONS,
  getOffsetAmount,
  getOffsetUnit,
  KIND_OPTIONS,
  type OffsetUnit,
  offsetUnitFactor,
} from "./reminders-tab-format";
// UFB-035: timezone catalog moved to ./timezone-options so the Settings →
// Reminders sub-tab (UFB-048 / Phase 48-B) can reuse the same curated list.
import { TIMEZONE_OPTIONS } from "./timezone-options";

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

export function PolicyForm({
  form,
  editing,
  isSaving,
  validityValid,
  onChange,
  onCancel,
  onSave,
}: PolicyFormProps) {
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

  return (
    <div
      data-testid="policy-form"
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] p-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="policy-kind"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Kind
          </label>
          <select
            id="policy-kind"
            value={form.kind}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                kind: e.target.value as MockReminderPolicy["kind"],
              }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="policy-audience"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Audience
          </label>
          <select
            id="policy-audience"
            value={form.audience}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                audience: e.target.value as MockReminderPolicy["audience"],
              }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            {AUDIENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 md:col-span-2">
          <label
            htmlFor="policy-offset-minutes"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
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
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
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
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
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
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            >
              <option value="before">before deadline</option>
              <option value="after">after deadline</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="policy-timezone"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Timezone
          </label>
          <select
            id="policy-timezone"
            value={form.timezone}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, timezone: e.target.value }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            {TIMEZONE_OPTIONS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.zones.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="policy-valid-from"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Valid from
          </label>
          <input
            id="policy-valid-from"
            type="date"
            value={form.validFromIso}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, validFromIso: e.target.value }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label
              htmlFor="policy-valid-until"
              className="text-xs font-semibold text-[var(--color-muted-foreground)]"
            >
              Valid until
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
              <input
                type="checkbox"
                checked={form.foreverChecked}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    foreverChecked: e.target.checked,
                    validUntilIso: e.target.checked ? null : prev.todayIso,
                  }))
                }
                aria-label="forever (no end date)"
              />
              <span>forever</span>
            </label>
          </div>
          <input
            id="policy-valid-until"
            type="date"
            value={form.validUntilIso ?? ""}
            disabled={form.foreverChecked}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                validUntilIso: e.target.value || null,
              }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[var(--color-muted)] disabled:opacity-50"
          />
        </div>
      </div>

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
            {isSaving ? "Saving…" : editing ? "Save changes" : "Create policy"}
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
