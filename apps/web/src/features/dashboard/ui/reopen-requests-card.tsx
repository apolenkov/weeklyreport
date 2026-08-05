"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { DashboardPanelIssue } from "./dashboard-panel-state";
import { ReopenRequestRow } from "./reopen-request-row";

// Anchor id for the AlertBar reopen indicator scroll target.
const REOPEN_REQUESTS_CARD_ID = "reopen-requests-card";

type DashboardReopenRequest = ComponentProps<
  typeof ReopenRequestRow
>["request"];
type ReopenDecision = "approved" | "rejected";

function useRespondReopenRequest(onResolved: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.admin.respondReopenRequest.mutationOptions({
      onSuccess: (result) => {
        onResolved();
        if (result.staleAutoClosed) {
          toast.info(
            "This section was already reopened; the request was closed.",
          );
        } else {
          toast.success(
            result.decision === "approved"
              ? "Request approved; section reopened."
              : "Request rejected.",
          );
        }
      },
      onError: (err) => {
        toast.error(`Failed to process request: ${err.message}`);
      },
      // Invalidate on settled (success OR error) so a stale/race outcome still
      // drops the now-terminal row from the queue and refreshes the count.
      onSettled: () => {
        void queryClient
          .invalidateQueries({
            queryKey: trpc.admin.listReopenRequests.queryKey(),
          })
          .catch(() => undefined);
        void queryClient
          .invalidateQueries({
            queryKey: trpc.admin.pendingReopenCount.queryKey(),
          })
          .catch(() => undefined);
      },
    }),
  );
}

interface ReopenRequestListProps {
  readonly requests: readonly DashboardReopenRequest[];
  readonly respondingId: string | null;
  readonly note: string;
  readonly onNoteChange: (note: string) => void;
  readonly onStartRespond: (id: string) => void;
  readonly onCancel: () => void;
  readonly onDecide: (id: string, decision: ReopenDecision) => void;
  readonly isPending: boolean;
  readonly pendingDecision: ReopenDecision | undefined;
}

function ReopenRequestList({
  requests,
  respondingId,
  note,
  onNoteChange,
  onStartRespond,
  onCancel,
  onDecide,
  isPending,
  pendingDecision,
}: ReopenRequestListProps) {
  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <ReopenRequestRow
          key={r.id}
          request={r}
          isResponding={respondingId === r.id}
          note={note}
          onNoteChange={onNoteChange}
          onStartRespond={() => onStartRespond(r.id)}
          onCancel={onCancel}
          onReject={() => onDecide(r.id, "rejected")}
          onApprove={() => onDecide(r.id, "approved")}
          isPending={isPending}
          pendingDecision={pendingDecision}
        />
      ))}
    </ul>
  );
}

function ReopenRequestsIssue({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  return (
    <div id={REOPEN_REQUESTS_CARD_ID}>
      <DashboardPanelIssue
        kind="leads"
        testId="reopen-requests-error"
        title="Reopen requests unavailable"
        description={
          error instanceof Error
            ? error.message
            : "The reopen queue could not be loaded."
        }
        onRetry={onRetry}
      />
    </div>
  );
}

function ReopenRequestsHeader({ count }: { readonly count: number }) {
  return (
    <header className="mb-3 flex items-center justify-between">
      <h2 className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]">
        Reopen Requests
      </h2>
      <span className="rounded-[var(--radius-pill)] bg-[var(--color-status-at-risk-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-status-at-risk-fg)]">
        {count} pending
      </span>
    </header>
  );
}

export function ReopenRequestsCard() {
  const trpc = useTRPC();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const closeResponder = () => {
    setRespondingId(null);
    setNote("");
  };

  const listQuery = useQuery(
    trpc.admin.listReopenRequests.queryOptions({ status: "pending" }),
  );
  const respondMut = useRespondReopenRequest(closeResponder);
  const requests = listQuery.data ?? [];

  if (listQuery.isPending) return null;

  if (listQuery.isError) {
    return (
      <ReopenRequestsIssue
        error={listQuery.error}
        onRetry={() => {
          void listQuery.refetch().catch(() => undefined);
        }}
      />
    );
  }

  // The card is a queue: render nothing when there is nothing to decide.
  if (requests.length === 0) return null;

  return (
    <section
      id={REOPEN_REQUESTS_CARD_ID}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card-elevated)]"
      aria-label="Pending reopen requests"
    >
      <ReopenRequestsHeader count={requests.length} />

      <ReopenRequestList
        requests={requests}
        respondingId={respondingId}
        note={note}
        onNoteChange={setNote}
        onStartRespond={(id) => {
          setRespondingId(id);
          setNote("");
        }}
        onCancel={closeResponder}
        onDecide={(id, decision) =>
          respondMut.mutate({ id, decision, note: note.trim() || undefined })
        }
        isPending={respondMut.isPending}
        pendingDecision={respondMut.variables?.decision}
      />
    </section>
  );
}
