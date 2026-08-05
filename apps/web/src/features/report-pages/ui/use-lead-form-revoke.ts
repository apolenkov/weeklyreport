"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import type { LeadFormGeneration } from "./lead-form-generation";
import { useGenerationState } from "./use-generation-state";

export function useLeadFormRevoke({
  generation,
  sectionIdForActions,
  setIsSubmitted,
}: {
  readonly generation: LeadFormGeneration | null;
  readonly sectionIdForActions: string | null;
  readonly setIsSubmitted: (next: boolean) => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [showRevokeDialog, setShowRevokeDialog] = useGenerationState(
    generation,
    false,
  );

  const revokeMut = useMutation(
    trpc.leadForm.revoke.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        invalidateDashboard(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        setIsSubmitted(false);
        toast.success("Section unlocked");
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Revoke failed";
        toast.error(msg);
      },
    }),
  );

  return {
    revokeMut,
    showRevokeDialog,
    setShowRevokeDialog,
    handleRevoke: () => setShowRevokeDialog(true),
    confirmRevoke: () => {
      setShowRevokeDialog(false);
      if (!sectionIdForActions) return;
      revokeMut.mutate({ reportSectionId: sectionIdForActions });
    },
  };
}
