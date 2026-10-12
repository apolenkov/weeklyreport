"use client";

import {
  type AppSettings,
  appSettingsUpdateSchema,
} from "@customreport/shared";
import { useState } from "react";

import { useServerSeededDraft } from "../../../shared/hooks/drafts/use-server-seeded-draft";
import {
  CheckIcon,
  useUpdateSettingsMut,
} from "../../../shared/ui/settings/settings-tab";

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
        autoComplete="email"
        placeholder="reports@yourdomain.com"
        value={value}
        aria-invalid={!isValid}
        aria-describedby={
          !isValid ? "notification-from-email-error" : undefined
        }
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.value)
        }
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
      />
      {!isValid && (
        <p
          id="notification-from-email-error"
          className="mt-1 text-xs text-[var(--color-destructive)]"
          role="alert"
        >
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
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Save notification settings"
      >
        {isSaving ? "Saving…" : "Save Notification Settings"}
      </button>
      {showSaved && (
        <span
          className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]"
          role="status"
          aria-live="polite"
        >
          <CheckIcon />
          Notification settings saved
        </span>
      )}
    </div>
  );
}

export function NotificationsSubTab({
  serverSettings,
}: {
  readonly serverSettings: AppSettings;
}) {
  const { draft, setDraft, markClean } =
    useServerSeededDraft<AppSettings>(serverSettings);
  const [showSaved, setShowSaved] = useState(false);

  const updateSettingsMut = useUpdateSettingsMut(
    "Notification settings",
    () => {
      markClean();
      setShowSaved(true);
    },
  );

  const trimmed = draft.notificationFromEmail?.trim() ?? "";
  const payload = { notificationFromEmail: trimmed === "" ? null : trimmed };
  const isValidEmail = appSettingsUpdateSchema.safeParse(payload).success;

  function handleSave() {
    updateSettingsMut.mutate(payload);
  }
  const isSaving = updateSettingsMut.isPending;

  return (
    <fieldset disabled={isSaving} className="min-w-0 max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Used as the From: address on outgoing reminder + escalation emails.
        Leave blank to fall back to the per-mailer default.
      </p>

      <NotificationFromEmailField
        value={draft.notificationFromEmail ?? ""}
        isValid={isValidEmail}
        onChange={(notificationFromEmail) => {
          setShowSaved(false);
          setDraft({ ...draft, notificationFromEmail });
        }}
      />

      <NotificationSaveRow
        onSave={handleSave}
        isSaving={isSaving}
        disabled={isSaving || !isValidEmail}
        showSaved={showSaved}
      />
    </fieldset>
  );
}
