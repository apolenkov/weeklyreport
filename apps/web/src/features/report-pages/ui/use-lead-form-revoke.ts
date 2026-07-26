"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

export function useLeadFormRevoke({
  sectionIdForActions,
  setIsSubmitted,
}: {
  readonly sectionIdForActions: string;
  readonly setIsSubmitted: (next: boolean) => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);

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
