"use client";

import type { ReviewVerdict, SectionReviewView } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateReview } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

type VerdictBadge =
  | { kind: "changes"; label: string }
  | { kind: "approved"; label: string }
  | { kind: "awaiting"; label: string }
  | { kind: "none"; label: string };

/**
 * Resolve the badge from the section's verdicts. `isCurrent` is server-derived
 * (judgedVersion === section.version), so a verdict left stale by a re-submission
 * reads "Awaiting review", never "Needs changes". With several reviewers a
 * current `changes_requested` outranks a current `approved` (the blocking signal
 * wins), keeping the badge deterministic.
 */
function resolveBadge(reviews: readonly SectionReviewView[]): VerdictBadge {
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

/**
 * review-acknowledgement (§6.3): the current-verdict badge plus, for a
 * designated reviewer, Approve / Request-changes buttons for one section. A
 * `changes_requested` verdict auto-un-submits server-side; this control reflects
 * the returned `unsubmitted` flag and invalidates the report query, it never
 * mutates status itself. It renders NO publish/lock control (that stays the
 * head/admin lifecycle), so a viewer-reviewer can judge but never publish.
 */
export function SectionVerdictControl({
  reportSectionId,
  version,
  reviews,
  canReview,
  onMutated,
}: {
  readonly reportSectionId: string;
  readonly version: number;
  readonly reviews: readonly SectionReviewView[];
  readonly canReview: boolean;
  readonly onMutated: () => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const badge = resolveBadge(reviews);

  const verdictMut = useMutation(
    trpc.review.verdict.mutationOptions({
      onSuccess: (result: { unsubmitted: boolean; verdict: ReviewVerdict }) => {
        toast.success(
          result.unsubmitted
            ? "Changes requested — section returned to the lead"
            : result.verdict === "approved"
              ? "Section approved"
              : "Changes requested",
        );
        invalidateReview(qc, trpc);
        onMutated();
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "Failed to record verdict",
        );
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
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-success-foreground)] transition-colors hover:border-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => submit("approved")}
            disabled={verdictMut.isPending}
          >
            Approve
          </button>
          <button
            type="button"
            className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-destructive)] transition-colors hover:border-[var(--color-destructive)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => submit("changes_requested")}
            disabled={verdictMut.isPending}
          >
            Request changes
          </button>
        </span>
      ) : null}
    </div>
  );
}
