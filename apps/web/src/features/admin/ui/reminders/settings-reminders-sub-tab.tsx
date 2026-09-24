"use client";

import type { AppSettings } from "@customreport/shared";
import { useState } from "react";

import { useServerSeededDraft } from "../../../../shared/hooks/drafts/use-server-seeded-draft";
import {
  CheckIcon,
  useUpdateSettingsMut,
} from "../../../../shared/ui/settings/settings-tab";
import { timezoneOptionsWith } from "../../model/timezone-options";

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
        {timezoneOptionsWith(value).map((group) => (
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
  const [showSaved, setShowSaved] = useState(false);

  function handleSave() {
    updateSettingsMut.mutate(
      { defaultTimezone: draft.defaultTimezone },
      {
        onSuccess: () => {
          markClean();
          setShowSaved(true);
        },
      },
    );
  }
  const isSaving = updateSettingsMut.isPending;

  return (
    <fieldset disabled={isSaving} className="min-w-0 max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Default timezone applied when an admin creates a new reminder. Existing
        reminders keep their own timezone.
      </p>

      <DefaultTimezoneField
        value={draft.defaultTimezone}
        onChange={(defaultTimezone) => {
          setShowSaved(false);
          setDraft({ ...draft, defaultTimezone });
        }}
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
        {showSaved && (
          <span
            className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]"
            role="status"
            aria-live="polite"
          >
            <CheckIcon />
            Reminder defaults saved
          </span>
        )}
      </div>
    </fieldset>
  );
}
