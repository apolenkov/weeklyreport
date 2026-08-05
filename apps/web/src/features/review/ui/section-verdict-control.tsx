"use client";

import type { ReviewVerdict, SectionReviewView } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateReview } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

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
  "btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-success-foreground)] transition-colors hover:border-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50";

const REQUEST_CHANGES_BUTTON_CLASSNAME =
  "btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-destructive)] transition-colors hover:border-[var(--color-destructive)] disabled:cursor-not-allowed disabled:opacity-50";

function VerdictActions({
  disabled,
  onSubmit,
}: {
  readonly disabled: boolean;
  readonly onSubmit: (verdict: ReviewVerdict) => void;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        className={APPROVE_BUTTON_CLASSNAME}
        onClick={() => onSubmit("approved")}
        disabled={disabled}
      >
        Approve
      </button>
      <button
        type="button"
        className={REQUEST_CHANGES_BUTTON_CLASSNAME}
        onClick={() => onSubmit("changes_requested")}
        disabled={disabled}
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
  readonly onMutated: () => void;
}

// Verdict badge + Approve/Request-changes for one section. Reflects server
// unsubmit; never mutates status or offers publish/lock (viewer-reviewer only).
export function SectionVerdictControl({
  reportSectionId,
  version,
  reviews,
  canReview,
  onMutated,
}: SectionVerdictControlProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const badge = resolveBadge(reviews);

  const verdictMut = useMutation(
    trpc.review.verdict.mutationOptions({
      onSuccess: (result: { unsubmitted: boolean; verdict: ReviewVerdict }) => {
        toast.success(verdictToastMessage(result));
        invalidateReview(qc, trpc);
        onMutated();
      },
      onError: (err: unknown) => {
        toast.error(errorToastMessage(err));
      },
    }),
  );

  const submit = (verdict: ReviewVerdict) => {
    verdictMut.mutate({ reportSectionId, verdict, version });
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className="whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
        style={{
          background: BADGE_STYLE[badge.kind].bg,
          color: BADGE_STYLE[badge.kind].fg,
        }}
      >
        {badge.label}
      </span>
      {canReview ? (
        <VerdictActions disabled={verdictMut.isPending} onSubmit={submit} />
      ) : null}
    </div>
  );
}
