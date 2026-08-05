"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateLeadForm } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import type { LeadFormGeneration } from "./lead-form-generation";
import { useGenerationState } from "./use-generation-state";

function useReopenDialog(generation: LeadFormGeneration | null) {
  const [show, setShow] = useGenerationState(generation, false);
  // Rejections stay in the dialog so the lead can amend the reason and retry.
  const [error, setError] = useGenerationState<string | null>(generation, null);
  return {
    error,
    setError,
    show,
    open: () => {
      setError(null);
      setShow(true);
    },
    close: () => {
      setShow(false);
      setError(null);
    },
  };
}

export function useLeadFormReopenRequest({
  generation,
  sectionIdForActions,
}: {
  readonly generation: LeadFormGeneration | null;
  readonly sectionIdForActions: string | null;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const dialog = useReopenDialog(generation);

  const requestReopenMut = useMutation(
    trpc.leadForm.requestReopen.mutationOptions({
      onSuccess: () => {
        dialog.close();
        invalidateLeadForm(qc, trpc);
        toast.success("Reopen request sent to Head");
      },
      onError: (err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Reopen request failed";
        dialog.setError(msg);
      },
    }),
  );

  return {
    requestReopenMut,
    reopenError: dialog.error,
    showReopenDialog: dialog.show,
    openReopenDialog: dialog.open,
    closeReopenDialog: dialog.close,
    handleRequestReopen: (reason: string | undefined) => {
      if (!sectionIdForActions) return;
      requestReopenMut.mutate({
        reportSectionId: sectionIdForActions,
        ...(reason ? { reason } : {}),
      });
    },
  };
}
