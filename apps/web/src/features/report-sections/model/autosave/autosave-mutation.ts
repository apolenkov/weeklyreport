"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import { invalidateLeadForm } from "../../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import { buildSaveDraftHandlers } from "./autosave-mutation-handlers";
import type { AutosaveMutationHandle, GetAutosaveRefs } from "./autosave-refs";
import type { AutosaveState, UseLeadFormAutosaveArgs } from "./autosave-types";

export interface SaveDraftMutationDeps {
  readonly getRefs: GetAutosaveRefs;
  readonly setState: Dispatch<SetStateAction<AutosaveState>>;
  readonly setLastSavedAt: Dispatch<SetStateAction<Date | null>>;
  readonly setLastSavedKey: (next: string) => void;
  readonly setQueuedRetryRevision: Dispatch<SetStateAction<number>>;
  readonly args: UseLeadFormAutosaveArgs;
}

// The narrowed return type also breaks the inference cycle between the mutation
// and the handlers built from it.
export function useSaveDraftMutation(
  deps: SaveDraftMutationDeps,
): AutosaveMutationHandle {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const saveDraftMut = useMutation(
    trpc.reports.saveDraft.mutationOptions(
      buildSaveDraftHandlers({
        getRefs: deps.getRefs,
        setState: deps.setState,
        setLastSavedAt: deps.setLastSavedAt,
        setLastSavedKey: deps.setLastSavedKey,
        setQueuedRetryRevision: deps.setQueuedRetryRevision,
        onVersionChange: deps.args.onVersionChange,
        onSaved: deps.args.onSaved,
        onConflict: deps.args.onConflict,
        reportSectionId: deps.args.reportSectionId,
        invalidate: () => invalidateLeadForm(qc, trpc),
        reportError: (message) => toast.error(message),
      }),
    ),
  );

  return {
    mutate: saveDraftMut.mutate,
    mutateAsync: saveDraftMut.mutateAsync,
    isPending: saveDraftMut.isPending,
  };
}
