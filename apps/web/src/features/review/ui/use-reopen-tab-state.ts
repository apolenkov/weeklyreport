import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";

export type ReopenFilterStatus = "pending" | "approved" | "rejected" | "all";

// Free-text match across every field the row renders, so what the admin reads
// is what the search box searches.
function matchesSearch(
  fields: readonly (string | null | undefined)[],
  query: string,
): boolean {
  return fields.filter(Boolean).join(" ").toLowerCase().includes(query);
}

// The response draft: which request is open in the respond form, plus its note.
function useRespondDraft() {
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  return {
    respondingId,
    note,
    setNote,
    start: (id: string) => {
      setRespondingId(id);
      setNote("");
    },
    reset: () => {
      setRespondingId(null);
      setNote("");
    },
  };
}

function useRespondReopenMutation(onResponded: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.admin.respondReopenRequest.mutationOptions({
      onSuccess: ({ decision }) => {
        toast.success(
          decision === "approved"
            ? "Request approved; section reopened."
            : "Request rejected.",
        );
        onResponded();
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.listReopenRequests.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.pendingReopenCount.queryKey(),
        });
      },
      onError: (err) => {
        toast.error(`Failed to process request: ${err.message}`);
      },
    }),
  );
}

/**
 * Use Reopen Tab State.
 */
export function useReopenTabState() {
  const trpc = useTRPC();
  const [filter, setFilter] = useState<ReopenFilterStatus>("pending");
  const [search, setSearch] = useState("");
  const draft = useRespondDraft();

  const listQuery = useQuery(
    trpc.admin.listReopenRequests.queryOptions({ status: filter }),
  );

  const respondMut = useRespondReopenMutation(draft.reset);

  const requests = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      matchesSearch(
        [
          r.requestedBy.name,
          r.requestedBy.email,
          r.report.weekLabel,
          r.reason,
          r.reviewNote,
        ],
        q,
      ),
    );
  }, [requests, search]);

  return {
    filter,
    setFilter,
    search,
    setSearch,
    requests,
    filteredRequests,
    listQuery,
    respondingId: draft.respondingId,
    note: draft.note,
    onNoteChange: draft.setNote,
    isSaving: respondMut.isPending,
    startRespond: draft.start,
    cancelRespond: draft.reset,
    respond: (id: string, decision: "approved" | "rejected") => {
      respondMut.mutate({ id, decision, note: draft.note.trim() || undefined });
    },
  };
}
