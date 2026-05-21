"use client";

import { useState, useTransition } from "react";
import { Bell, BellRing, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc-context";

type RemindLeadButtonProps = {
  readonly reportId: string;
  readonly leadId: string;
  readonly leadName: string;
};

type ConfirmState = "idle" | "sent" | "already" | "error";

/**
 * One-click Remind action for the Head Dashboard pulse (plan §23.4 T-F4-4).
 *
 * Uses the existing reminders.dispatchPending mutation with the new optional
 * leadId filter so the client never sees lead emails — the backend resolves
 * the active rule + recipient + dedupe key. useTransition keeps the click
 * responsive while the mutation runs.
 */
export function RemindLeadButton({
  reportId,
  leadId,
  leadName,
}: RemindLeadButtonProps): React.JSX.Element {
  const trpc = useTRPC();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmState>("idle");

  const mutation = useMutation(
    trpc.reminders.dispatchPending.mutationOptions({
      onSuccess: (result) => {
        if (result.dispatched > 0) {
          setConfirm("sent");
        } else if (result.alreadySent > 0) {
          setConfirm("already");
        } else {
          setConfirm("error");
        }
        window.setTimeout(() => setConfirm("idle"), 2400);
      },
      onError: () => {
        setConfirm("error");
        window.setTimeout(() => setConfirm("idle"), 2400);
      },
    }),
  );

  const handleClick = (): void => {
    startTransition(() => {
      mutation.mutate({ reportId, leadId });
    });
  };

  const busy = isPending || mutation.isPending;
  const label =
    confirm === "sent"
      ? "Sent"
      : confirm === "already"
        ? "Already sent"
        : confirm === "error"
          ? "Retry"
          : busy
            ? "Sending"
            : "Remind";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || confirm === "sent" || confirm === "already"}
      aria-busy={busy}
      aria-label={`Send reminder to ${leadName}`}
      title={`Send reminder to ${leadName}`}
      data-testid="remind-lead-button"
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-2 py-1 text-[12px] font-semibold text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-default disabled:opacity-60"
    >
      {confirm === "sent" || confirm === "already" ? (
        <Check size={12} strokeWidth={2.5} aria-hidden="true" />
      ) : busy ? (
        <BellRing size={12} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Bell size={12} strokeWidth={2} aria-hidden="true" />
      )}
      <span>{label}</span>
    </button>
  );
}
