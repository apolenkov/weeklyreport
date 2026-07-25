"use client";

import type { ReviewAcknowledgementView } from "@customreport/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";

export interface AcknowledgeGroup {
  readonly groupId: string;
  readonly label?: string;
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
  const trpc = useTRPC();
  const qc = useQueryClient();
  const suffix = group.label ? ` · ${group.label}` : "";
  const acksQ = useQuery(
    trpc.review.acknowledgements.queryOptions({
      reportId,
      groupId: group.groupId,
    }),
  );
  const acks: ReviewAcknowledgementView[] = acksQ.data ?? [];
  const acknowledged = acks.some((ack) => ack.userId === currentUserId);

  const ackMut = useMutation(
    trpc.review.acknowledge.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries(trpc.review.acknowledgements.pathFilter());
        toast.success("Acknowledged");
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-press inline-flex items-center gap-1.5 max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-3 py-1 text-[12px] font-semibold text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => ackMut.mutate({ reportId, groupId: group.groupId })}
        disabled={ackMut.isPending || acknowledged}
        aria-pressed={acknowledged}
      >
        {(acknowledged ? "Acknowledged" : "Acknowledge") + suffix}
      </button>
      {isHeadOrAdmin && acks.length > 0 ? (
        <span className="text-[11px] text-[var(--color-muted-foreground)]">
          Seen by {acks.map((ack) => ack.userName ?? "—").join(", ")}
        </span>
      ) : null}
    </div>
  );
}
