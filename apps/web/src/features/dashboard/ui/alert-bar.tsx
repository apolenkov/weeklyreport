"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { IfRole } from "../../../shared/ui/auth-runtime/if-role";

interface AlertBarProps {
  readonly pendingLeads: readonly string[];
  readonly reportId: string;
  readonly ruleId: string | null;
}

function AlertIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-shrink-0"
      style={{ color: "var(--color-starbucks-gold)" }}
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

function pluralSuffix(count: number): string {
  return count === 1 ? "" : "s";
}

// Parenthesised tail listing the leads the dispatch did NOT newly notify.
function formatDispatchExtras(alreadySent: number, skipped: number): string {
  const extras = [
    alreadySent > 0 ? `${alreadySent} already sent this cycle` : null,
    skipped > 0 ? `${skipped} opted out` : null,
  ].filter((extra) => extra !== null);
  return extras.length > 0 ? ` (${extras.join(", ")})` : "";
}

// Primitive-typed mirror of the dispatch result so the copy lives outside the
// component without importing the tRPC output type.
interface DispatchOutcome {
  readonly dispatched: number;
  readonly alreadySent: number;
  readonly skipped: number;
  readonly noActiveRule: boolean;
}

function toastDispatchOutcome({
  dispatched,
  alreadySent,
  skipped,
  noActiveRule,
}: DispatchOutcome): void {
  if (noActiveRule) {
    toast.info(
      "Reminder rule is not configured for this period. Configure it in Admin → Reminders.",
    );
    return;
  }
  if (dispatched === 0 && alreadySent === 0 && skipped === 0) {
    toast.info("No pending leads to remind.");
    return;
  }
  if (dispatched === 0 && alreadySent > 0) {
    toast.info(
      `All ${alreadySent} pending lead${pluralSuffix(alreadySent)} already received this cycle's reminder.`,
    );
    return;
  }
  toast.success(
    `Reminder sent to ${dispatched} lead${pluralSuffix(dispatched)}${formatDispatchExtras(alreadySent, skipped)}.`,
  );
}

function ConfigureRemindersLink() {
  return (
    <IfRole forRole="admin">
      <Link
        href="/admin?tab=reminders"
        className="text-xs font-semibold text-[var(--color-starbucks-accent)] underline-offset-4 hover:underline"
      >
        Configure reminders
      </Link>
    </IfRole>
  );
}

export function AlertBar({ pendingLeads, reportId, ruleId }: AlertBarProps) {
  const trpc = useTRPC();
  const dispatchMut = useMutation(
    trpc.reminders.dispatchPending.mutationOptions({
      onSuccess: ({ dispatched, alreadySent, skipped, reason }) => {
        toastDispatchOutcome({
          dispatched,
          alreadySent,
          skipped,
          noActiveRule: reason === "no-active-rule",
        });
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to send reminder",
        );
      },
    }),
  );

  if (pendingLeads.length === 0) return null;

  return (
    <div
      // No token exists for the amber alert surface: `--color-warning` is the
      // border accent and is too saturated as a fill. The two-part shadow is the
      // dashboard card elevation shared with kpi-cards and reopen-requests-card.
      className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-status-at-risk-bg)] p-3 shadow-[var(--shadow-card-elevated)]"
      style={{ borderLeft: "3px solid var(--color-warning)" }}
    >
      <AlertIcon />
      <div className="flex flex-1 flex-col gap-1 text-sm">
        <span>
          <strong>{pendingLeads.length}</strong> lead
          {pluralSuffix(pendingLeads.length)} haven&apos;t started
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          if (ruleId) dispatchMut.mutate({ reportId, ruleId });
        }}
        disabled={dispatchMut.isPending || ruleId === null}
        aria-busy={dispatchMut.isPending}
        className="btn-press ml-auto inline-flex min-h-[36px] items-center rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-3.5 py-1.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        title={ruleId ? undefined : "Active deadline reminder required."}
      >
        {dispatchMut.isPending ? "Sending…" : "Send Reminder"}
      </button>
      {!ruleId && <ConfigureRemindersLink />}
    </div>
  );
}
