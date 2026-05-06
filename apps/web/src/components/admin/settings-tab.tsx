'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { invalidateAdmin } from '../../lib/cache-keys';
import { useTRPC } from '../../lib/trpc-context';

import type { MockSettings } from './mock-data';

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
        toast.success('Settings saved');
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to save settings');
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
        General department settings for CustomReport
      </p>

      <div className="max-w-lg space-y-5">
        {/* Department Name */}
        <div>
          <label htmlFor="dept-name" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
            Department Name
          </label>
          <input
            id="dept-name"
            type="text"
            value={draft.departmentName}
            onChange={(e) => setDraft({ ...draft, departmentName: e.target.value })}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Displayed in report headers and navigation
          </p>
        </div>

        {/* Auto-create Periods */}
        <div className="flex items-start justify-between gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-5 py-4">
          <div>
            <span className="text-sm font-medium text-[var(--color-foreground)]">
              Auto-create Periods
            </span>
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              Automatically create new weekly reporting periods based on the calendar
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.autoCreatePeriods}
            aria-label="Toggle auto-create periods"
            onClick={() =>
              setDraft({ ...draft, autoCreatePeriods: !draft.autoCreatePeriods })
            }
            className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: draft.autoCreatePeriods
                ? 'var(--color-starbucks-accent)'
                : 'var(--color-border)',
            }}
          >
            <span
              className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{
                transform: draft.autoCreatePeriods ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>

        {/* Default Deadline Days */}
        <div>
          <label htmlFor="deadline-days" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
            Default Deadline (days from period start)
          </label>
          <input
            id="deadline-days"
            type="number"
            min={1}
            max={7}
            value={draft.defaultDeadlineDays}
            onChange={(e) =>
              setDraft({ ...draft, defaultDeadlineDays: parseInt(e.target.value, 10) || 5 })
            }
            className="w-32 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Number of days after period start when submissions are due (1-7)
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
            {isSaving ? 'Saving...' : 'Save Settings'}
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
