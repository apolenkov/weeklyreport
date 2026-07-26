import type { PolicyFormState } from "../model/reminders-form-state";
import { TIMEZONE_OPTIONS } from "../model/timezone-options";
import {
  POLICY_FORM_INPUT_CLASS,
  POLICY_FORM_LABEL_CLASS,
} from "./policy-form-styles";

interface PolicyFieldProps {
  readonly form: PolicyFormState;
  readonly onChange: (
    next: PolicyFormState | ((prev: PolicyFormState) => PolicyFormState),
  ) => void;
}

function TimezoneField({ form, onChange }: PolicyFieldProps) {
  return (
    <div className="md:col-span-2">
      <label htmlFor="policy-timezone" className={POLICY_FORM_LABEL_CLASS}>
        Timezone
      </label>
      <select
        id="policy-timezone"
        value={form.timezone}
        onChange={(e) =>
          onChange((prev) => ({ ...prev, timezone: e.target.value }))
        }
        className={POLICY_FORM_INPUT_CLASS}
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
  );
}

function ValidFromField({ form, onChange }: PolicyFieldProps) {
  return (
    <div>
      <label htmlFor="policy-valid-from" className={POLICY_FORM_LABEL_CLASS}>
        Valid from
      </label>
      <input
        id="policy-valid-from"
        type="date"
        value={form.validFromIso}
        onChange={(e) =>
          onChange((prev) => ({ ...prev, validFromIso: e.target.value }))
        }
        className={POLICY_FORM_INPUT_CLASS}
      />
    </div>
  );
}

// Checking "forever" clears the end date; unchecking restores today so the
// date input never re-opens on an empty value.
function ForeverToggle({ form, onChange }: PolicyFieldProps) {
  return (
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
  );
}

function ValidUntilField({ form, onChange }: PolicyFieldProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label
          htmlFor="policy-valid-until"
          className="text-xs font-semibold text-[var(--color-muted-foreground)]"
        >
          Valid until
        </label>
        <ForeverToggle form={form} onChange={onChange} />
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
        className={`${POLICY_FORM_INPUT_CLASS} disabled:cursor-not-allowed disabled:bg-[var(--color-muted)] disabled:opacity-50`}
      />
    </div>
  );
}

export function PolicyFormAdvancedFields({ form, onChange }: PolicyFieldProps) {
  return (
    <details
      data-testid="reminder-advanced"
      className="mt-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white"
    >
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--color-muted-foreground)]">
        Advanced
      </summary>
      <div className="grid gap-4 border-t border-[var(--color-border)] p-3 md:grid-cols-2">
        <TimezoneField form={form} onChange={onChange} />
        <ValidFromField form={form} onChange={onChange} />
        <ValidUntilField form={form} onChange={onChange} />
      </div>
    </details>
  );
}
