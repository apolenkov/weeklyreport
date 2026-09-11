import type { ReopenRequestStatusFilter } from "@customreport/shared";
import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  invalidateLeadForm,
  invalidateSubmissionDashboard,
} from "../../../shared/lib/query/cache-keys";
import type { TRPCProxy } from "../../../shared/lib/trpc/trpc";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

export type ReopenFilterStatus = ReopenRequestStatusFilter;
const MAX_REOPEN_SEARCH_LENGTH = 500;

function listInput(filter: ReopenFilterStatus, search: string) {
  const normalizedSearch = search.trim();
  return {
    status: filter,
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
  };
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

function refreshReopenRequests(
  queryClient: QueryClient,
  trpc: TRPCProxy,
): void {
  void Promise.all([
    queryClient.invalidateQueries(trpc.admin.listReopenRequests.pathFilter()),
    queryClient.invalidateQueries(trpc.admin.pendingReopenCount.pathFilter()),
  ]).catch(() => undefined);
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
      },
      onError: (err) => {
        toast.error(`Failed to process request: ${err.message}`);
      },
      onSettled: () => {
        refreshReopenRequests(queryClient, trpc);
        invalidateSubmissionDashboard(queryClient, trpc);
        invalidateLeadForm(queryClient, trpc);
      },
    }),
  );
}

export function useReopenTabState() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filter, setFilterState] = useState<ReopenFilterStatus>("pending");
  const [search, setSearchState] = useState("");
  const draft = useRespondDraft();

  const listQuery = useInfiniteQuery(
    trpc.admin.listReopenRequests.infiniteQueryOptions(
      listInput(filter, search),
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    ),
  );

  const respondMut = useRespondReopenMutation(draft.reset);

  const requests = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data?.pages],
  );

  return {
    filter,
    setFilter: (next: ReopenFilterStatus) => {
      if (next === filter) return;
      queryClient.removeQueries(
        trpc.admin.listReopenRequests.infiniteQueryFilter(
          listInput(next, search),
          { exact: true },
        ),
      );
      setFilterState(next);
    },
    search,
    setSearch: (next: string) => {
      const capped = next.slice(0, MAX_REOPEN_SEARCH_LENGTH);
      if (capped === search) return;
      if (capped.trim() !== search.trim()) {
        queryClient.removeQueries(
          trpc.admin.listReopenRequests.infiniteQueryFilter(
            listInput(filter, capped),
            { exact: true },
          ),
        );
      }
      setSearchState(capped);
    },
    requests,
    listQuery,
    respondingId: draft.respondingId,
    note: draft.note,
    onNoteChange: draft.setNote,
    isSaving: respondMut.isPending,
    pendingDecision: respondMut.variables?.decision,
    startRespond: draft.start,
    cancelRespond: draft.reset,
    respond: (id: string, decision: "approved" | "rejected") => {
      respondMut.mutate({ id, decision, note: draft.note.trim() || undefined });
    },
  };
}
