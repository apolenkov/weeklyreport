"use client";

import { useMutation } from "@tanstack/react-query";
import { Bell, BellRing, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTRPC } from "../../lib/trpc-context";

type RemindLeadButtonProps = {
  readonly reportId: string;
  readonly leadId: string;
  readonly leadName: string;
};

type ConfirmState = "idle" | "sent" | "already" | "no-section" | "error";

const CONFIRM_HOLD_MS = 2400;

/**
 * One-click Remind action for the Head Dashboard pulse (plan §23.4 T-F4-4).
 *
 * Uses reminders.dispatchPending with the leadId filter so the client never
 * sees lead emails — backend resolves the active rule + recipient + dedupe
 * key. useMutation.isPending alone covers the busy UI state; useTransition
 * is unnecessary because mutate() returns void synchronously.
 */
export function RemindLeadButton({
  reportId,
  leadId,
  leadName,
}: RemindLeadButtonProps): React.JSX.Element {
  const trpc = useTRPC();
  const [confirm, setConfirm] = useState<ConfirmState>("idle");
  const timerRef = useRef<number | null>(null);

  const scheduleReset = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setConfirm("idle");
      timerRef.current = null;
    }, CONFIRM_HOLD_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [],
  );

  const mutation = useMutation(
    trpc.reminders.dispatchPending.mutationOptions({
      onSuccess: (result) => {
        if (result.reason === "no-matching-section") {
          setConfirm("no-section");
        } else if (result.dispatched > 0) {
          setConfirm("sent");
        } else if (result.alreadySent > 0) {
          setConfirm("already");
        } else {
          setConfirm("error");
        }
        scheduleReset();
      },
      onError: () => {
        setConfirm("error");
        scheduleReset();
      },
    }),
  );

  const handleClick = (): void => {
    mutation.mutate({ reportId, leadId });
  };

  const busy = mutation.isPending;
  const label =
    confirm === "sent"
      ? "Sent"
      : confirm === "already"
        ? "Already sent"
        : confirm === "no-section"
          ? "No sections matched"
          : confirm === "error"
            ? "Retry"
            : busy
              ? "Sending"
              : "Remind";

  // aria-live surfaces sent/error transitions to assistive tech without
  // duplicating the button label (sr-only sibling avoids visual noise).
  const liveMessage =
    confirm === "sent"
      ? `Reminder sent to ${leadName}`
      : confirm === "already"
        ? `Reminder already sent to ${leadName} this cycle`
        : confirm === "no-section"
          ? `No sections matched this lead for ${leadName}`
          : confirm === "error"
            ? `Reminder to ${leadName} failed; retry available`
            : "";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={
          busy ||
          confirm === "sent" ||
          confirm === "already" ||
          confirm === "no-section"
        }
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
      <span aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </>
  );
}
