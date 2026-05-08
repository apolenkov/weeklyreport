'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../lib/trpc-context';

type AlertBarProps = {
  readonly pendingLeads: string[];
  readonly reportId: string;
  readonly canSendReminder: boolean;
};

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-shrink-0"
      style={{ color: 'var(--color-starbucks-gold)' }}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function AlertBar({
  pendingLeads,
  reportId,
  canSendReminder,
}: AlertBarProps) {
  const trpc = useTRPC();
  const dispatchMut = useMutation(
    trpc.reminders.dispatchPending.mutationOptions({
      onSuccess: ({ dispatched, alreadySent, skipped, reason }) => {
        if (reason === 'no-active-rule') {
          toast.info(
            'Reminder rule is not configured for this period. Configure it in Admin → Reminders.',
          );
          return;
        }
        if (dispatched === 0 && alreadySent === 0 && skipped === 0) {
          toast.info('No pending leads to remind.');
          return;
        }
        if (dispatched === 0 && alreadySent > 0) {
          toast.info(
            `All ${alreadySent} pending lead${alreadySent === 1 ? '' : 's'} already received this cycle's reminder.`,
          );
          return;
        }
        const extras: string[] = [];
        if (alreadySent > 0) extras.push(`${alreadySent} already sent this cycle`);
        if (skipped > 0) extras.push(`${skipped} opted out`);
        const tail = extras.length ? ` (${extras.join(', ')})` : '';
        toast.success(
          `Reminder sent to ${dispatched} lead${dispatched === 1 ? '' : 's'}${tail}.`,
        );
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to send reminder');
      },
    }),
  );

  if (pendingLeads.length === 0) return null;

  const pendingNames = pendingLeads.map((name, i) => {
    const isLast = i === pendingLeads.length - 1;
    const isDraft = i === 0;
    return (
      <span key={`${name}-${i}`}>
        <strong>{name}</strong> ({isDraft ? 'Draft' : 'Not started'})
        {!isLast && ' and '}
      </span>
    );
  });

  return (
    <div
      className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[#fffbeb] p-3 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
      style={{ borderLeft: '3px solid var(--color-warning)' }}
    >
      <AlertIcon />
      <span className="flex-1 text-sm">
        {pendingNames} haven&apos;t submitted
      </span>
      <button
        type="button"
        onClick={() => dispatchMut.mutate({ reportId })}
        disabled={dispatchMut.isPending || !canSendReminder}
        className="btn-press ml-auto inline-flex min-h-[36px] items-center rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-3.5 py-1.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        title={
          canSendReminder
            ? undefined
            : 'Configure a reminder rule in Admin → Reminders first'
        }
      >
        {dispatchMut.isPending ? 'Sending…' : 'Send Reminder'}
      </button>
      {!canSendReminder && (
        <a
          href="/admin?tab=reminders"
          className="text-xs font-semibold text-[var(--color-starbucks-accent)] underline-offset-4 hover:underline"
        >
          Configure reminders
        </a>
      )}
    </div>
  );
}
