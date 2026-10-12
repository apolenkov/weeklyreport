import type { ReportSectionReadModel } from "@customreport/shared";
import { useCallback, useState } from "react";

import type { LeadFormWritePort } from "../lead-form/lead-form-write-port";
import type { AutosaveRequest } from "./autosave-types";

// The mutation port used by the autosave engine.
export interface AutosaveMutationHandle {
  readonly mutate: (request: AutosaveRequest) => void;
  readonly mutateAsync: (request: AutosaveRequest) => Promise<unknown>;
  readonly isPending: boolean;
}

export function unboundAutosaveMutation(): AutosaveMutationHandle {
  const message =
    "Autosave mutation invoked before the sync effect bound the live handle";
  return {
    mutate: () => {
      throw new Error(message);
    },
    mutateAsync: () => Promise.reject(new Error(message)),
    isPending: false,
  };
}

export interface SaveDraftMutationDeps {
  readonly writePort: LeadFormWritePort;
  readonly onSuccess: (
    saved: ReportSectionReadModel,
    request: AutosaveRequest,
  ) => void;
  readonly onError: (error: unknown, request: AutosaveRequest) => void;
}

// Pure mutation transport: the write-port call plus in-flight bookkeeping.
// All live autosave state stays with the caller — this hook receives only
// ordinary values and result callbacks.
export function useSaveDraftMutation(
  deps: SaveDraftMutationDeps,
): AutosaveMutationHandle {
  const [pendingCount, setPendingCount] = useState(0);
  const { writePort, onSuccess, onError } = deps;

  const mutateAsync = useCallback<AutosaveMutationHandle["mutateAsync"]>(
    async (request) => {
      setPendingCount((count) => count + 1);
      try {
        const saved = await writePort.saveDraft({
          ...request.payload,
          version: request.version,
        });
        onSuccess(saved, request);
        return saved;
      } catch (error: unknown) {
        onError(error, request);
        throw error;
      } finally {
        setPendingCount((count) => count - 1);
      }
    },
    [writePort, onSuccess, onError],
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
