"use client";

import { useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  useUpdateSettingsMut,
} from "../../../shared/ui/settings-tab-shared";
import type { MockSettings } from "../../admin";

// The wire schema accepts null (clear) or a valid email; we keep the input as a
// string and translate empty → null on save. UI guard: a non-empty string that
// fails a basic email shape blocks Save with a hint.
function looksLikeEmail(trimmed: string): boolean {
  // eslint-disable-next-line sonarjs/super-linear-regex -- linear negated character classes, no catastrophic backtracking; bounded form input
  return trimmed === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

// Seed only fresh server data: skip while dirty (refetch must not clobber
// edits) and skip already-seeded refs — else post-save dirty flip re-fires
// against pre-save props and the field flickers back.
function useServerSeededDraft(serverSettings: MockSettings) {
  const [draft, setDraft] = useState<MockSettings>(serverSettings);
  const [isDirty, setIsDirty] = useState(false);

  const lastSeeded = useRef<MockSettings>(serverSettings);
  useEffect(() => {
    if (!isDirty && serverSettings !== lastSeeded.current) {
      lastSeeded.current = serverSettings;
      setDraft(serverSettings);
    }
  }, [serverSettings, isDirty]);

  return { draft, setDraft, setIsDirty };
}

function NotificationFromEmailField({
  value,
  isValid,
  onChange,
}: {
  readonly value: string;
  readonly isValid: boolean;
  readonly onChange: (next: string | null) => void;
}) {
  return (
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
        value={value}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.value)
        }
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
      />
      {!isValid && (
        <p className="mt-1 text-xs text-red-600">
          Enter a valid email or leave the field empty.
        </p>
      )}
    </div>
  );
}

function NotificationSaveRow({
  onSave,
  isSaving,
  disabled,
  showSaved,
}: {
  readonly onSave: () => void;
  readonly isSaving: boolean;
  readonly disabled: boolean;
  readonly showSaved: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Save notification settings"
      >
        {isSaving ? "Saving…" : "Save Notification Settings"}
      </button>
      {showSaved && (
        <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
          <CheckIcon />
          Notification settings saved
        </span>
      )}
    </div>
  );
}

/**
 * Notifications Sub Tab.
 * @param options - The options argument.
 */
export function NotificationsSubTab({
  serverSettings,
}: {
  readonly serverSettings: MockSettings;
}) {
  const { draft, setDraft, setIsDirty } = useServerSeededDraft(serverSettings);

  const updateSettingsMut = useUpdateSettingsMut("Notification settings", () =>
    setIsDirty(false),
  );

  const trimmed = draft.notificationFromEmail?.trim() ?? "";
  const isValidEmail = looksLikeEmail(trimmed);

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

      <NotificationFromEmailField
        value={draft.notificationFromEmail ?? ""}
        isValid={isValidEmail}
        onChange={(notificationFromEmail) => {
          setIsDirty(true);
          setDraft({ ...draft, notificationFromEmail });
        }}
      />

      <NotificationSaveRow
        onSave={handleSave}
        isSaving={isSaving}
        disabled={isSaving || !isValidEmail}
        showSaved={updateSettingsMut.isSuccess}
      />
    </div>
  );
}
