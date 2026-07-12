"use client";

import { useEffect, useRef, useState } from "react";

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
  const [isDirty, setIsDirty] = useState(false);

  // Reseed the draft only from FRESH server data: skip while dirty (a
  // background refetch must not overwrite an in-progress edit) and skip data
  // already seeded — otherwise the dirty flag's post-save flip re-fires this
  // effect while the parent still passes the pre-save settings and the
  // just-typed field flickers back to the old value.
  const lastSeeded = useRef<MockSettings>(serverSettings);
  useEffect(() => {
    if (!isDirty && serverSettings !== lastSeeded.current) {
      lastSeeded.current = serverSettings;
      setDraft(serverSettings);
    }
  }, [serverSettings, isDirty]);

  const updateSettingsMut = useUpdateSettingsMut("Notification settings", () =>
    setIsDirty(false),
  );

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
          placeholder="reports@yourdomain.com"
          value={draft.notificationFromEmail ?? ""}
          onChange={(e) => {
            setIsDirty(true);
            setDraft({
              ...draft,
              notificationFromEmail:
                e.target.value === "" ? null : e.target.value,
            });
          }}
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
