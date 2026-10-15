"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReviewAcknowledgementView } from "@weeklyreport/shared";
import { toast } from "sonner";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

export interface AcknowledgeGroup {
  readonly groupId: string;
  readonly label: string;
}

// Per-group Acknowledge on the live report — any access-holder, NOT gated by
// canReview. "Who acknowledged" roster is head/admin only.
export function ReviewAcknowledgeBar({
  reportId,
  groups,
  currentUserId,
  isHeadOrAdmin,
}: {
  readonly reportId: string;
  readonly groups: readonly AcknowledgeGroup[];
  readonly currentUserId: string;
  readonly isHeadOrAdmin: boolean;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {groups.map((group) => (
        <AcknowledgeGroupControl
          key={group.groupId}
          reportId={reportId}
          group={group}
          currentUserId={currentUserId}
          isHeadOrAdmin={isHeadOrAdmin}
        />
      ))}
    </div>
  );
}

function useAcknowledgeGroup(
  reportId: string,
  groupId: string,
  currentUserId: string,
) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const acksQ = useQuery(
    trpc.review.acknowledgements.queryOptions({ reportId, groupId }),
  );
  useQueryErrorHandler(acksQ, {
    event: "review.acknowledgements.load_failed",
    component: "ReviewAcknowledgeBar",
    procedure: "review.acknowledgements",
    context: { reportId, groupId },
  });
  // A failed roster must not read as "nobody acknowledged" — withhold it and inert the control.
  const acks: ReviewAcknowledgementView[] = acksQ.isError
    ? []
    : (acksQ.data ?? []);
  const rosterUnavailable = acksQ.isError;
  // Own status is unknown until the roster loads: no click, no pressed state.
  const rosterLoading = acksQ.isPending;

  const ackMut = useMutation(
    trpc.review.acknowledge.mutationOptions({
      // Awaiting the refetch keeps the mutation pending until the roster shows
      // the receipt, so the control never re-enables in between.
      onSuccess: async () => {
        toast.success("Acknowledged");
        await qc
          .invalidateQueries(trpc.review.acknowledgements.pathFilter())
          .catch(() => undefined);
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "Failed to acknowledge",
        );
      },
    }),
  );

  return {
    acks,
    acknowledged: acks.some((ack) => ack.userId === currentUserId),
    rosterUnavailable,
    rosterLoading,
    ackMut,
  };
}

function acknowledgeLabel(
  pending: boolean,
  rosterLoading: boolean,
  acknowledged: boolean,
): string {
  if (pending) return "Acknowledging…";
  if (rosterLoading) return "Acknowledge…";
  return acknowledged ? "Acknowledged" : "Acknowledge";
}

function AcknowledgeGroupControl({
  reportId,
  group,
  currentUserId,
  isHeadOrAdmin,
}: {
  readonly reportId: string;
  readonly group: AcknowledgeGroup;
  readonly currentUserId: string;
  readonly isHeadOrAdmin: boolean;
}) {
  const suffix = ` · ${group.label}`;
  const { acks, acknowledged, rosterUnavailable, rosterLoading, ackMut } =
    useAcknowledgeGroup(reportId, group.groupId, currentUserId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-press inline-flex items-center gap-1.5 max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-3 py-1 text-[12px] font-semibold text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => ackMut.mutate({ reportId, groupId: group.groupId })}
        disabled={
          ackMut.isPending || acknowledged || rosterUnavailable || rosterLoading
        }
        aria-pressed={rosterLoading ? undefined : acknowledged}
        aria-busy={ackMut.isPending || rosterLoading}
      >
        {acknowledgeLabel(ackMut.isPending, rosterLoading, acknowledged) +
          suffix}
      </button>
      {rosterUnavailable ? (
        <span className="text-xs text-[var(--color-destructive)]" role="alert">
          Could not load acknowledgements
        </span>
      ) : isHeadOrAdmin && acks.length > 0 ? (
        <span className="text-xs text-[var(--color-muted-foreground)]">
          Seen by {acks.map((ack) => ack.userName ?? "—").join(", ")}
        </span>
      ) : null}
    </div>
  );
}
