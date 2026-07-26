"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateLeadForm } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

export function useLeadFormReopenRequest({
  sectionIdForActions,
}: {
  readonly sectionIdForActions: string;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  // Rejections stay inside the dialog instead of a toast so the lead can fix
  // the reason and retry without reopening it.
  const [reopenError, setReopenError] = useState<string | null>(null);

  const requestReopenMut = useMutation(
    trpc.leadForm.requestReopen.mutationOptions({
      onSuccess: () => {
        setShowReopenDialog(false);
        setReopenError(null);
        invalidateLeadForm(qc, trpc);
        toast.success("Reopen request sent to Head");
      },
      onError: (err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Reopen request failed";
        setReopenError(msg);
      },
    }),
  );

  return {
    requestReopenMut,
    reopenError,
    showReopenDialog,
    openReopenDialog: () => {
      setReopenError(null);
      setShowReopenDialog(true);
    },
    closeReopenDialog: () => {
      setShowReopenDialog(false);
      setReopenError(null);
    },
    handleRequestReopen: (reason: string | undefined) => {
      if (!sectionIdForActions) return;
      requestReopenMut.mutate({
        reportSectionId: sectionIdForActions,
        ...(reason ? { reason } : {}),
      });
    },
  };
}
