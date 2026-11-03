"use client";

import {
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import type { ReviewVerdict, SectionReviewView } from "@weeklyreport/shared";
import { reviewVerdictInputSchema } from "@weeklyreport/shared";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { mutationErrorMessage } from "../../../shared/lib/errors/mutation-error-message";
import { invalidateReview } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { RequestChangesDialog } from "./request-changes-dialog";

type VerdictBadge =
  | { kind: "changes"; label: string }
  | { kind: "approved"; label: string }
  | { kind: "awaiting"; label: string }
  | { kind: "none"; label: string };

// isCurrent is server-derived — a stale post-resubmit verdict reads "Awaiting
// review". Current changes_requested outranks approved (blocking signal wins).
export function resolveBadge(
  reviews: readonly SectionReviewView[],
): VerdictBadge {
  const current = reviews.filter((review) => review.isCurrent);
  if (current.some((review) => review.verdict === "changes_requested")) {
    return { kind: "changes", label: "Changes requested" };
  }
  if (current.some((review) => review.verdict === "approved")) {
    return { kind: "approved", label: "Approved" };
  }
  if (reviews.length > 0) {
    return { kind: "awaiting", label: "Awaiting review" };
  }
  return { kind: "none", label: "Not reviewed" };
}

const BADGE_STYLE: Record<VerdictBadge["kind"], { bg: string; fg: string }> = {
  changes: {
    bg: "var(--color-status-blocked-bg)",
    fg: "var(--color-destructive)",
  },
  approved: {
    bg: "var(--color-success)",
    fg: "var(--color-success-foreground)",
  },
  awaiting: {
    bg: "var(--color-status-in-progress-bg)",
    fg: "var(--color-status-in-progress-fg)",
  },
  none: { bg: "var(--color-muted)", fg: "var(--color-muted-foreground)" },
};

function VerdictBadgeLabel({ badge }: { readonly badge: VerdictBadge }) {
  return (
    <span
      className="whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold"
      style={{
        background: BADGE_STYLE[badge.kind].bg,
        color: BADGE_STYLE[badge.kind].fg,
      }}
    >
      {badge.label}
    </span>
  );
}

// A changes-requested verdict that unsubmitted the section outranks the plain
// verdict copy — the lead getting the section back is the newsworthy part.
function verdictToastMessage(result: {
  unsubmitted: boolean;
  verdict: ReviewVerdict;
}): string {
  if (result.unsubmitted) {
    return "Changes requested — section returned to the lead";
  }
  return result.verdict === "approved"
    ? "Section approved"
    : "Changes requested";
}

const APPROVE_BUTTON_CLASSNAME =
  "btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-2.5 py-0.5 text-xs font-semibold text-[var(--color-success-foreground)] transition-colors hover:border-[var(--color-success)] aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const REQUEST_CHANGES_BUTTON_CLASSNAME =
  "btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-2.5 py-0.5 text-xs font-semibold text-[var(--color-destructive)] transition-colors hover:border-[var(--color-destructive)] aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

// Lists of leads repeat these buttons; the lead's name keeps each one unique
// for assistive tech while the visible text stays short. The pending state uses
// aria-disabled with a click guard: a natively disabled focused button drops
// focus to <body>.
function VerdictActions({
  subjectName,
  pending,
  disabled,
  onApprove,
  onRequestChanges,
}: {
  readonly subjectName: string | undefined;
  // Pending drives the "Saving…" copy; disabled also covers an open reason
  // dialog, which owns the next verdict write even before it is pending.
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly onApprove: () => void;
  readonly onRequestChanges: () => void;
}) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <button
        type="button"
        data-interaction-effect="mutation-required"
        className={APPROVE_BUTTON_CLASSNAME}
        onClick={() => {
          if (!disabled) onApprove();
        }}
        aria-disabled={disabled}
        aria-label={
          subjectName
            ? `${pending ? "Saving verdict for" : "Approve"} ${subjectName}`
            : undefined
        }
        aria-busy={pending}
      >
        {pending ? "Saving…" : "Approve"}
      </button>
      <button
        type="button"
        data-interaction-effect="mutation-required"
        className={REQUEST_CHANGES_BUTTON_CLASSNAME}
        onClick={() => {
          if (!disabled) onRequestChanges();
        }}
        aria-disabled={disabled}
        aria-label={
          subjectName ? `Request changes for ${subjectName}` : undefined
        }
        aria-busy={pending}
      >
        Request changes
      </button>
    </span>
  );
}

interface SectionVerdictControlProps {
  readonly reportSectionId: string;
  readonly version: number;
  readonly reviews: readonly SectionReviewView[];
  readonly canReview: boolean;
  /** Section owner; names the verdict buttons and the reason dialog. */
  readonly subjectName?: string | undefined;
  readonly onMutated: () => void;
}

function useSectionVerdictPending(reportSectionId: string) {
  const pendingVerdicts = useMutationState({
    filters: {
      status: "pending",
      predicate: (mutation) => {
        const command = reviewVerdictInputSchema.safeParse(
          mutation.state.variables,
        );
        return (
          command.success && command.data.reportSectionId === reportSectionId
        );
      },
    },
    select: (mutation) => mutation.state.status,
  });
  return pendingVerdicts.length > 0;
}

function recoverUnsubmittedFocus(
  control: HTMLElement | null,
  dialogOpen: boolean,
) {
  const active = document.activeElement;
  const ownsFocus =
    control?.contains(active) === true ||
    (dialogOpen &&
      active instanceof Element &&
      active.closest('[role="dialog"]'));
  if (!ownsFocus) return;
  const author = control?.closest<HTMLElement>('[id^="report-lead-"]');
  const sections = control?.closest<HTMLElement>(
    '[aria-label="Report sections"]',
  );
  const verdict = control?.closest<HTMLElement>(
    '[aria-label="Section verdict"]',
  );
  window.setTimeout(() => {
    if (
      document.activeElement !== document.body &&
      verdict?.isSameNode(document.activeElement) !== true
    )
      return;
    (author?.isConnected ? author : sections)?.focus({ preventScroll: true });
  }, 0);
}

// Verdict badge + Approve/Request-changes for one section. Reflects server
// unsubmit; never mutates status or offers publish/lock (viewer-reviewer only).
export function SectionVerdictControl({
  reportSectionId,
  version,
  reviews,
  canReview,
  subjectName,
  onMutated,
}: SectionVerdictControlProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const badge = resolveBadge(reviews);
  const pending = useSectionVerdictPending(reportSectionId);
  const [control, setControl] = useState<HTMLDivElement | null>(null);

  const [requestingChanges, setRequestingChanges] = useState(false);
  if (!canReview && requestingChanges) setRequestingChanges(false);

  const onVerdictRecorded = (result: {
    unsubmitted: boolean;
    verdict: ReviewVerdict;
  }) => {
    if (result.unsubmitted) recoverUnsubmittedFocus(control, requestingChanges);
    toast.success(verdictToastMessage(result));
    invalidateReview(qc, trpc);
    onMutated();
  };

  // Two keypresses can land before React re-renders the pending state, so the
  // guard must flip synchronously; each would otherwise write a verdict.
  const approveInFlight = useRef(false);
  const verdictMut = useMutation(
    trpc.review.verdict.mutationOptions({
      onSuccess: onVerdictRecorded,
      onError: (err: unknown) => {
        toast.error(mutationErrorMessage(err, "Failed to record verdict"));
      },
    }),
  );

  return (
    <div
      ref={setControl}
      className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center"
    >
      <VerdictBadgeLabel badge={badge} />
      {canReview ? (
        <VerdictActions
          subjectName={subjectName}
          pending={pending}
          disabled={pending || requestingChanges}
          onApprove={() => {
            if (pending || approveInFlight.current) return;
            approveInFlight.current = true;
            verdictMut.mutate(
              { reportSectionId, verdict: "approved", version },
              {
                onSettled: () => {
                  approveInFlight.current = false;
                },
              },
            );
          }}
          onRequestChanges={() => setRequestingChanges(true)}
        />
      ) : null}
      {requestingChanges && canReview ? (
        <RequestChangesDialog
          reportSectionId={reportSectionId}
          version={version}
          subjectName={subjectName}
          onClose={() => setRequestingChanges(false)}
          onRequested={onVerdictRecorded}
        />
      ) : null}
    </div>
  );
}
