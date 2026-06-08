"use client";

import { useEffect, useState } from "react";

import type { MockSettings } from "./mock-data";
import { CheckIcon, useUpdateSettingsMut } from "./settings-tab-shared";
import { TIMEZONE_OPTIONS } from "./timezone-options";

export function RemindersSubTab({
  serverSettings,
}: {
  readonly serverSettings: MockSettings;
}) {
  const [draft, setDraft] = useState<MockSettings>(serverSettings);
  useEffect(() => setDraft(serverSettings), [serverSettings]);
  const updateSettingsMut = useUpdateSettingsMut("Reminder defaults");

  function handleSave() {
    updateSettingsMut.mutate({
      defaultTimezone: draft.defaultTimezone,
      defaultReminderAudience: draft.defaultReminderAudience,
    });
  }
  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Defaults applied to the «New Policy» form on the Reminders tab. Existing
        policies keep their per-policy values.
      </p>

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
          value={draft.defaultTimezone}
          onChange={(e) =>
            setDraft({ ...draft, defaultTimezone: e.target.value })
          }
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
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
          IANA zone used as default when admins create a new ReminderPolicy.
        </p>
      </div>

      <div>
        <label
          htmlFor="default-audience"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Default audience
        </label>
        <select
          id="default-audience"
          name="default-audience"
          value={draft.defaultReminderAudience}
          onChange={(e) =>
            setDraft({
              ...draft,
              defaultReminderAudience: e.target
                .value as MockSettings["defaultReminderAudience"],
            })
          }
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        >
          <option value="lead-with-draft">Leads with draft</option>
          <option value="head-of-late">Head of late leads</option>
        </select>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Recipient group preselected on the «New Policy» form.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
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
