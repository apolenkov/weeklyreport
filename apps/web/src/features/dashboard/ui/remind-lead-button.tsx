"use client";

import type { ReminderDispatchResult } from "@customreport/shared";
import { useMutation } from "@tanstack/react-query";
import { Bell, BellRing, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

interface RemindLeadButtonProps {
  readonly reportId: string;
  readonly ruleId: string;
  readonly leadId: string;
  readonly leadName: string;
  readonly onMutated: () => void;
}

const NO_SECTION_CONFIRM_STATE = "no-section";

type ConfirmState =
  | "idle"
  | "queued"
  | "already"
  | "skipped"
  | typeof NO_SECTION_CONFIRM_STATE
  | "error";

const CONFIRM_HOLD_MS = 2400;

// Confirmation feedback owns the label while it holds; `null` hands the label
// back to the busy/idle pair.
const CONFIRM_LABELS: Record<ConfirmState, string | null> = {
  idle: null,
  queued: "Queued",
  already: "Already requested",
  skipped: "Skipped",
  [NO_SECTION_CONFIRM_STATE]: "No sections matched",
  error: "Retry",
};

// aria-live surfaces request/error transitions to assistive tech without
// duplicating the button label (sr-only sibling avoids visual noise).
const CONFIRM_LIVE_MESSAGES: Record<
  ConfirmState,
  (leadName: string) => string
> = {
  idle: () => "",
  queued: (leadName) => `Reminder queued for ${leadName}`,
  already: (leadName) =>
    `Reminder already requested for ${leadName} this cycle`,
  skipped: (leadName) => `Reminder for ${leadName} was skipped`,
  [NO_SECTION_CONFIRM_STATE]: (leadName) =>
    `No sections matched this lead for ${leadName}`,
  error: (leadName) => `Reminder to ${leadName} failed; retry available`,
};

// States where re-sending is pointless or would duplicate: the button locks.
const SETTLED_CONFIRM_STATES: ReadonlySet<ConfirmState> = new Set<ConfirmState>(
  ["queued", "already", "skipped", NO_SECTION_CONFIRM_STATE],
);

// Only accepted or deduplicated requests earn the check glyph.
const CHECKED_CONFIRM_STATES: ReadonlySet<ConfirmState> = new Set<ConfirmState>(
  ["queued", "already"],
);

const confirmStateFromDispatch = (
  result: ReminderDispatchResult,
): ConfirmState => {
  if (result.reason === "no-matching-section") return NO_SECTION_CONFIRM_STATE;
  if (result.failed > 0) return "error";
  if (result.queued > 0) return "queued";
  if (result.alreadyRequested > 0) return "already";
  if (result.skipped > 0) return "skipped";
  return "error";
};

interface RemindLeadState {
  readonly confirm: ConfirmState;
  readonly busy: boolean;
  readonly send: () => void;
}

// Client never sees lead emails — backend resolves rule, recipient, and dedupe.
function useRemindLead({
  reportId,
  ruleId,
  leadId,
  onMutated,
}: Omit<RemindLeadButtonProps, "leadName">): RemindLeadState {
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
    trpc.reminders.dispatchPending.mutationOptions(),
  );

  return {
    confirm,
    busy: mutation.isPending,
    send: () => {
      mutation.mutate(
        { reportId, ruleId, leadId },
        {
          onSuccess: (result) => {
            setConfirm(confirmStateFromDispatch(result));
            onMutated();
            scheduleReset();
          },
          onError: () => {
            setConfirm("error");
            scheduleReset();
          },
        },
      );
    },
  };
}

function ConfirmIcon({
  confirm,
  busy,
}: {
  readonly confirm: ConfirmState;
  readonly busy: boolean;
}): React.JSX.Element {
  if (CHECKED_CONFIRM_STATES.has(confirm)) {
    return <Check size={12} strokeWidth={2.5} aria-hidden="true" />;
  }
  return busy ? (
    <BellRing size={12} strokeWidth={2} aria-hidden="true" />
  ) : (
    <Bell size={12} strokeWidth={2} aria-hidden="true" />
  );
}

export function RemindLeadButton({
  reportId,
  ruleId,
  leadId,
  leadName,
  onMutated,
}: RemindLeadButtonProps): React.JSX.Element {
  const { confirm, busy, send } = useRemindLead({
    reportId,
    ruleId,
    leadId,
    onMutated,
  });
  const label = CONFIRM_LABELS[confirm] ?? (busy ? "Requesting" : "Remind");
  const liveMessage = CONFIRM_LIVE_MESSAGES[confirm](leadName);

  return (
    <>
      <button
        type="button"
        onClick={send}
        disabled={busy || SETTLED_CONFIRM_STATES.has(confirm)}
        aria-busy={busy}
        aria-label={`Send reminder to ${leadName}`}
        title={`Send reminder to ${leadName}`}
        data-testid="remind-lead-button"
        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-[12px] font-semibold text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-default disabled:opacity-60 max-md:min-h-[var(--touch-target-min)]"
      >
        <ConfirmIcon confirm={confirm} busy={busy} />
        <span>{label}</span>
      </button>
      <span aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </>
  );
}
