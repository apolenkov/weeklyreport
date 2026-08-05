"use client";

import type { AppSettings } from "@customreport/shared";

import { useServerSeededDraft } from "../../../shared/hooks/drafts/use-server-seeded-draft";
import {
  CheckIcon,
  useUpdateSettingsMut,
} from "../../../shared/ui/settings/settings-tab";
import { TIMEZONE_OPTIONS } from "../model/timezone-options";

function DefaultTimezoneField({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor="default-timezone"
        className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
      >
        Default timezone
      </label>
      <select
        id="default-timezone"
        name="default-timezone"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
      >
        {TIMEZONE_OPTIONS.map((group) => (
          <optgroup key={group.group} label={group.group}>
            {group.zones.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        IANA zone used as the default when an admin creates a new reminder.
      </p>
    </div>
  );
}

export function RemindersSubTab({
  serverSettings,
}: {
  readonly serverSettings: AppSettings;
}) {
  const { draft, setDraft, markClean } =
    useServerSeededDraft<AppSettings>(serverSettings);
  const updateSettingsMut = useUpdateSettingsMut("Reminder defaults");

  function handleSave() {
    // TODO(simplify-admin-reminders-ui): drop the inert
    // `defaultReminderAudience` column + Zod field. The Reminder type preset
    // owns the kind/audience pairing, so this surface omits the control.
    updateSettingsMut.mutate(
      { defaultTimezone: draft.defaultTimezone },
      { onSuccess: () => markClean() },
    );
  }
  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Default timezone applied when an admin creates a new reminder. Existing
        reminders keep their own timezone.
      </p>

      <DefaultTimezoneField
        value={draft.defaultTimezone}
        onChange={(defaultTimezone) => setDraft({ ...draft, defaultTimezone })}
      />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Save reminder defaults"
        >
          {isSaving ? "Saving…" : "Save Reminder Defaults"}
        </button>
        {updateSettingsMut.isSuccess && (
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
            <CheckIcon />
            Reminder defaults saved
          </span>
        )}
      </div>
    </div>
  );
}
