import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";

export type ReopenFilterStatus = "pending" | "approved" | "rejected" | "all";

export function useReopenTabState() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReopenFilterStatus>("pending");
  const [search, setSearch] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const listQuery = useQuery(
    trpc.admin.listReopenRequests.queryOptions({ status: filter }),
  );

  const respondMut = useMutation(
    trpc.admin.respondReopenRequest.mutationOptions({
      onSuccess: ({ decision }) => {
        toast.success(
          decision === "approved"
            ? "Request approved; section reopened."
            : "Request rejected.",
        );
        setRespondingId(null);
        setNote("");
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

  const requests = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => {
      const haystack = [
        r.requestedBy.name,
        r.requestedBy.email,
        r.report.weekLabel,
        r.reason,
        r.reviewNote,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [requests, search]);

  function startRespond(id: string) {
    setRespondingId(id);
    setNote("");
  }

  function cancelRespond() {
    setRespondingId(null);
    setNote("");
  }

  function respond(id: string, decision: "approved" | "rejected") {
    respondMut.mutate({ id, decision, note: note.trim() || undefined });
  }

  return {
    filter,
    setFilter,
    search,
    setSearch,
    requests,
    filteredRequests,
    listQuery,
    respondingId,
    note,
    onNoteChange: setNote,
    isSaving: respondMut.isPending,
    startRespond,
    cancelRespond,
    respond,
  };
}
