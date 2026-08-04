"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateLeadForm } from "../../../lib/cache-keys";
import { isConflictError } from "../../../lib/trpc";
import { useTRPC } from "../../../lib/trpc-context";
import type { LeadFormGeneration } from "./lead-form-generation";
import { useGenerationState } from "./use-generation-state";

interface FillFromInput {
  readonly targetSectionId: string;
  readonly sourceSectionId: string;
  readonly version: number;
}

function useFillFromConfirmation(
  generation: LeadFormGeneration | null,
  autosaveDirty: boolean,
  createInput: (sourceSectionId: string) => FillFromInput | null,
  fillFrom: (input: FillFromInput) => void,
) {
  const [pendingInput, setPendingInput] =
    useGenerationState<FillFromInput | null>(generation, null);
  return {
    pendingFillFrom: pendingInput !== null,
    handleFillFrom: (sourceSectionId: string) => {
      const input = createInput(sourceSectionId);
      if (input === null) return;
      if (autosaveDirty) {
        setPendingInput(input);
        return;
      }
      fillFrom(input);
    },
    confirmPendingFillFrom: () => {
      if (pendingInput === null) return;
      const input = pendingInput;
      setPendingInput(null);
      fillFrom(input);
    },
    cancelPendingFillFrom: () => setPendingInput(null),
  };
}

export function useLeadFormFillFrom({
  generation,
  sectionIdForActions,
  autosaveDirty,
  version,
  handleConflict,
}: {
  readonly generation: LeadFormGeneration | null;
  readonly sectionIdForActions: string | null;
  readonly autosaveDirty: boolean;
  readonly version: number;
  readonly handleConflict: () => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const fillFromMut = useMutation(
    trpc.leadForm.fillFrom.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        toast.success("Form filled from selected period");
      },
      onError: (err: unknown) => {
        if (isConflictError(err)) {
          handleConflict();
          return;
        }
        const msg = err instanceof Error ? err.message : "Fill from failed";
        toast.error(msg);
      },
    }),
  );

  const confirmation = useFillFromConfirmation(
    generation,
    autosaveDirty,
    (sourceSectionId) =>
      sectionIdForActions
        ? { targetSectionId: sectionIdForActions, sourceSectionId, version }
        : null,
    (input) => fillFromMut.mutate(input),
  );

  return {
    fillFromMut,
    ...confirmation,
  };
}
