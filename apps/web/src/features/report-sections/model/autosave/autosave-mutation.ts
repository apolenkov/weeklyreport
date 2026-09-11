import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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
  const [pendingCount, setPendingCount] = useState(0);
  const handlers = useMemo(
    () =>
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
        reportError: (message) => toast.error(message),
      }),
    [deps],
  );

  const mutateAsync = useCallback<AutosaveMutationHandle["mutateAsync"]>(
    async (request) => {
      setPendingCount((count) => count + 1);
      try {
        const saved = await deps.args.writePort.saveDraft({
          ...request.payload,
          version: request.version,
        });
        handlers.onSuccess(saved, request);
        return saved;
      } catch (error: unknown) {
        handlers.onError(error, request.generation);
        throw error;
      } finally {
        setPendingCount((count) => count - 1);
      }
    },
    [deps.args.writePort, handlers],
  );
  const mutate = useCallback<AutosaveMutationHandle["mutate"]>(
    (request) => {
      void mutateAsync(request).catch(() => undefined);
    },
    [mutateAsync],
  );

  return {
    mutate,
    mutateAsync,
    isPending: pendingCount > 0,
  };
}
