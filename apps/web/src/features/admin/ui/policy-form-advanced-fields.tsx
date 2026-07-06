import type { PolicyFormState } from "../model/reminders-form-state";
import { TIMEZONE_OPTIONS } from "../model/timezone-options";

const INPUT_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm";
const LABEL_CLASS =
  "mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]";

/**
 * The reminder form's collapsed-by-default "Advanced" fieldset (extracted
 * from policy-form.tsx): timezone override + validity window, including
 * the "forever" checkbox that clears `validUntilIso`.
 */
export function PolicyFormAdvancedFields({
  form,
  onChange,
}: {
  readonly form: PolicyFormState;
  readonly onChange: (
    next: PolicyFormState | ((prev: PolicyFormState) => PolicyFormState),
  ) => void;
}) {
  return (
    <details
      data-testid="reminder-advanced"
      className="mt-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white"
    >
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--color-muted-foreground)]">
        Advanced
      </summary>
      <div className="grid gap-4 border-t border-[var(--color-border)] p-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="policy-timezone" className={LABEL_CLASS}>
            Timezone
          </label>
          <select
            id="policy-timezone"
            value={form.timezone}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, timezone: e.target.value }))
            }
            className={INPUT_CLASS}
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
          <label htmlFor="policy-valid-from" className={LABEL_CLASS}>
            Valid from
          </label>
          <input
            id="policy-valid-from"
            type="date"
            value={form.validFromIso}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, validFromIso: e.target.value }))
            }
            className={INPUT_CLASS}
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
            className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:bg-[var(--color-muted)] disabled:opacity-50`}
          />
        </div>
      </div>
    </details>
  );
}
