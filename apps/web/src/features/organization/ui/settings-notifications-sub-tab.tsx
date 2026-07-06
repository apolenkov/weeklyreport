"use client";

import { useEffect, useState } from "react";

import type { MockSettings } from "../../../shared/lib/admin-mock-data";
import {
  CheckIcon,
  useUpdateSettingsMut,
} from "../../../shared/ui/settings-tab-shared";

export function NotificationsSubTab({
  serverSettings,
}: {
  readonly serverSettings: MockSettings;
}) {
  const [draft, setDraft] = useState<MockSettings>(serverSettings);
  useEffect(() => setDraft(serverSettings), [serverSettings]);
  const updateSettingsMut = useUpdateSettingsMut("Notification settings");

  // The wire schema accepts null (clear) or a valid email; we keep the input
  // as a string and translate empty → null on save. UI guard: a non-empty
  // string that fails a basic email shape blocks Save with a hint.
  const trimmed = draft.notificationFromEmail?.trim() ?? "";
  const looksLikeEmail =
    // eslint-disable-next-line sonarjs/super-linear-regex -- linear negated character classes, no catastrophic backtracking; bounded form input
    trimmed === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  function handleSave() {
    updateSettingsMut.mutate({
      notificationFromEmail: trimmed === "" ? null : trimmed,
    });
  }
  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Used as the From: address on outgoing reminder + escalation emails.
        Leave blank to fall back to the per-mailer default.
      </p>

      <div>
        <label
          htmlFor="notification-from-email"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Notification from-email
        </label>
        <input
          id="notification-from-email"
          name="notification-from-email"
          type="email"
          autoComplete="off"
          placeholder="reports@example.com"
          value={draft.notificationFromEmail ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              notificationFromEmail:
                e.target.value === "" ? null : e.target.value,
            })
          }
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        {!looksLikeEmail && (
          <p className="mt-1 text-xs text-red-600">
            Enter a valid email or leave the field empty.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !looksLikeEmail}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Save notification settings"
        >
          {isSaving ? "Saving…" : "Save Notification Settings"}
        </button>
        {updateSettingsMut.isSuccess && (
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
            <CheckIcon />
            Notification settings saved
          </span>
        )}
      </div>
    </div>
  );
}
