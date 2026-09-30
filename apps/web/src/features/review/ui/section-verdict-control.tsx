"use client";

import type { ReviewVerdict, SectionReviewView } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

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

const errorToastMessage = (err: unknown): string =>
  err instanceof Error && err.message
    ? err.message
    : "Failed to record verdict";

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
  disabled,
  onApprove,
  onRequestChanges,
}: {
  readonly subjectName: string | undefined;
  readonly disabled: boolean;
  readonly onApprove: () => void;
  readonly onRequestChanges: () => void;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        data-interaction-effect="mutation-required"
        className={APPROVE_BUTTON_CLASSNAME}
        onClick={() => {
          if (!disabled) onApprove();
        }}
        aria-disabled={disabled}
        aria-label={subjectName ? `Approve ${subjectName}` : undefined}
        aria-busy={disabled}
      >
        {disabled ? "Saving…" : "Approve"}
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
        aria-busy={disabled}
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

  const [requestingChanges, setRequestingChanges] = useState(false);

  const onVerdictRecorded = (result: {
    unsubmitted: boolean;
    verdict: ReviewVerdict;
  }) => {
    toast.success(verdictToastMessage(result));
    invalidateReview(qc, trpc);
    onMutated();
  };

  const verdictMut = useMutation(
    trpc.review.verdict.mutationOptions({
      onSuccess: onVerdictRecorded,
      onError: (err: unknown) => {
        toast.error(errorToastMessage(err));
      },
    }),
  );

  return (
    <div className="flex items-center gap-2">
      <span
        className="whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold"
        style={{
          background: BADGE_STYLE[badge.kind].bg,
          color: BADGE_STYLE[badge.kind].fg,
        }}
      >
        {badge.label}
      </span>
      {canReview ? (
        <VerdictActions
          subjectName={subjectName}
          disabled={verdictMut.isPending}
          onApprove={() =>
            verdictMut.mutate({
              reportSectionId,
              verdict: "approved",
              version,
            })
          }
          onRequestChanges={() => setRequestingChanges(true)}
        />
      ) : null}
      {requestingChanges ? (
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
