"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import { ReopenRequestRow } from "./reopen-request-row";

// Anchor id for the AlertBar reopen indicator scroll target.
const REOPEN_REQUESTS_CARD_ID = "reopen-requests-card";

export function ReopenRequestsCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const listQuery = useQuery(
    trpc.admin.listReopenRequests.queryOptions({ status: "pending" }),
  );

  const respondMut = useMutation(
    trpc.admin.respondReopenRequest.mutationOptions({
      onSuccess: (result) => {
        setRespondingId(null);
        setNote("");
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
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.listReopenRequests.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.pendingReopenCount.queryKey(),
        });
      },
    }),
  );

  const requests = listQuery.data ?? [];

  // The card is a queue: render nothing when there is nothing to decide.
  if (listQuery.isPending || listQuery.isError || requests.length === 0) {
    return null;
  }

  return (
    <section
      id={REOPEN_REQUESTS_CARD_ID}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
      aria-label="Pending reopen requests"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]">
          Reopen Requests
        </h2>
        <span className="rounded-[var(--radius-pill)] bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
          {requests.length} pending
        </span>
      </header>

      <ul className="space-y-3">
        {requests.map((r) => (
          <ReopenRequestRow
            key={r.id}
            request={r}
            isResponding={respondingId === r.id}
            note={note}
            onNoteChange={setNote}
            onStartRespond={() => {
              setRespondingId(r.id);
              setNote("");
            }}
            onCancel={() => {
              setRespondingId(null);
              setNote("");
            }}
            onReject={() =>
              respondMut.mutate({
                id: r.id,
                decision: "rejected",
                note: note.trim() || undefined,
              })
            }
            onApprove={() =>
              respondMut.mutate({
                id: r.id,
                decision: "approved",
                note: note.trim() || undefined,
              })
            }
            isPending={respondMut.isPending}
            pendingDecision={respondMut.variables?.decision}
          />
        ))}
      </ul>
    </section>
  );
}
