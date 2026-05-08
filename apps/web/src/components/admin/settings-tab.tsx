"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import { useTRPC } from "../../lib/trpc-context";

import type { MockSettings } from "./mock-data";

type SettingsTabProps = {
  readonly settings: MockSettings;
};

export function SettingsTab({ settings: serverSettings }: SettingsTabProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<MockSettings>(serverSettings);

  // Re-seed local edit state whenever the source query revalidates so the form
  // never shows stale values after `invalidateAdmin` triggers a refetch.
  useEffect(() => {
    setDraft(serverSettings);
  }, [serverSettings]);

  const updateSettingsMut = useMutation(
    trpc.admin.updateSettings.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Settings saved");
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to save settings");
      },
    }),
  );

  function handleSave() {
    // `appSettingsUpdateSchema` is a partial; sending the full draft is safe
    // and lets the backend merge as needed.
    updateSettingsMut.mutate({
      departmentName: draft.departmentName,
      autoCreatePeriods: draft.autoCreatePeriods,
      defaultDeadlineDays: draft.defaultDeadlineDays,
    });
  }

  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Report defaults that affect period creation, deadlines, and report
        header copy.
      </p>

      <div className="max-w-lg space-y-5">
        <div>
          <label
            htmlFor="dept-name"
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            Report header name
          </label>
          <input
            id="dept-name"
            name="department-name"
            type="text"
            autoComplete="off"
            value={draft.departmentName}
            onChange={(e) =>
              setDraft({ ...draft, departmentName: e.target.value })
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Displayed in report headers. User membership is managed in Groups.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
          <input
            name="auto-create-periods"
            type="checkbox"
            checked={draft.autoCreatePeriods}
            onChange={(e) =>
              setDraft({ ...draft, autoCreatePeriods: e.target.checked })
            }
            className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
          />
          <span>
            <span className="block font-medium">Auto-create periods</span>
            <span className="block text-xs text-[var(--color-muted-foreground)]">
              Create the next reporting period automatically when the schedule
              advances.
            </span>
          </span>
        </label>

        <div>
          <label
            htmlFor="deadline-days"
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            Default deadline days
          </label>
          <input
            id="deadline-days"
            name="deadline-days"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={draft.defaultDeadlineDays}
            onChange={(e) =>
              setDraft({
                ...draft,
                defaultDeadlineDays: Number.parseInt(e.target.value, 10) || 1,
              })
            }
            className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Number of days after period start before reports are due.
          </p>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Save settings"
          >
            {isSaving ? "Saving…" : "Save Settings"}
          </button>
          {updateSettingsMut.isSuccess && !updateSettingsMut.isPending && (
            <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
              <CheckIcon />
              Settings saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
