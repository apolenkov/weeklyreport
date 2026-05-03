'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { invalidateAdmin } from '../../lib/cache-keys';
import { toAdminReminderRuleInput } from '../../lib/mappers';
import { useTRPC } from '../../lib/trpc-context';
import { ConfirmDeleteDialog } from '../lead/confirm-delete-dialog';

import type { MockReminder } from './mock-data';

type RemindersTabProps = {
  readonly reminders: MockReminder[];
};

export function RemindersTab({ reminders }: RemindersTabProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MockReminder | null>(null);

  const saveRuleMut = useMutation(
    trpc.admin.saveReminderRule.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success('Reminder updated');
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to update reminder');
      },
    }),
  );

  const deleteRuleMut = useMutation(
    trpc.admin.deleteReminderRule.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success('Reminder deleted');
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to delete reminder');
      },
    }),
  );

  function handleToggle(reminder: MockReminder) {
    const nextStatus: 'active' | 'paused' = reminder.active ? 'paused' : 'active';
    saveRuleMut.mutate(
      toAdminReminderRuleInput(
        {
          kind: reminder.kind,
          fireAt: reminder.fireAt,
          timezone: reminder.timezone,
          status: nextStatus,
          reportId: reminder.reportId,
          version: reminder.version,
        },
        reminder.id,
      ),
    );
  }

  function handleDelete(reminder: MockReminder) {
    setPendingDelete(reminder);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteRuleMut.mutate({ ruleId: pendingDelete.id });
    setPendingDelete(null);
  }

  function handleSendNow(id: string) {
    setSendingId(id);
    // Send-now is an admin trigger; no dedicated endpoint exists yet — keep
    // the visual feedback for now and surface a backend gap in SUMMARY.
    setTimeout(() => setSendingId(null), 1500);
  }

  const isMutating = saveRuleMut.isPending || deleteRuleMut.isPending;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Configure automatic email reminders for report submissions
      </p>

      <div className="space-y-3">
        {reminders.map((reminder) => (
          <div
            key={reminder.id}
            className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-5 py-4 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center gap-4">
              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={reminder.active}
                aria-label={`Toggle ${reminder.name}`}
                onClick={() => handleToggle(reminder)}
                disabled={isMutating}
                className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: reminder.active ? 'var(--color-starbucks-accent)' : 'var(--color-border)',
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                  style={{
                    transform: reminder.active ? 'translateX(20px)' : 'translateX(0)',
                  }}
                />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--color-foreground)]">
                    {reminder.name}
                  </span>
                  <span
                    className="rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: reminder.active ? 'var(--color-success)' : 'var(--color-muted)',
                      color: reminder.active ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                    }}
                  >
                    {reminder.active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {reminder.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSendNow(reminder.id)}
                disabled={sendingId === reminder.id}
                className="btn-press inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Send ${reminder.name} now`}
              >
                {sendingId === reminder.id ? (
                  <>
                    <SpinnerIcon />
                    Sending...
                  </>
                ) : (
                  <>
                    <SendIcon />
                    Send Now
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(reminder)}
                disabled={isMutating}
                className="btn-press rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--color-destructive)] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Delete ${reminder.name}`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete reminder rule?"
        preview={pendingDelete?.name ?? ''}
        subtitle={pendingDelete ? formatReminderSchedule(pendingDelete.fireAt, pendingDelete.timezone) : undefined}
        consequence="No further emails will be sent for this rule."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function formatReminderSchedule(fireAt: unknown, timezone: string): string {
  const d = fireAt instanceof Date ? fireAt : new Date(String(fireAt));
  if (Number.isNaN(d.getTime())) return timezone;
  const time = d.toISOString().slice(11, 16);
  return `${time} UTC · ${timezone}`;
}

// ---- Icons ----

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
    </svg>
  );
}
