"use client";

import { toast } from "sonner";

import type { LeadFormGeneration } from "../../report-sections";
import type { LeadFormWritePort } from "../../report-sections/client";
import { useGenerationState } from "../../report-sections/client";

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
  writePort,
}: {
  readonly generation: LeadFormGeneration | null;
  readonly sectionIdForActions: string | null;
  readonly writePort: LeadFormWritePort;
}) {
  const dialog = useReopenDialog(generation);

  const requestReopen = async (reason: string | undefined) => {
    if (!sectionIdForActions) return;
    try {
      await writePort.requestReopen({
        reportSectionId: sectionIdForActions,
        ...(reason ? { reason } : {}),
      });
      dialog.close();
      toast.success("Reopen request sent to Head");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Reopen request failed";
      dialog.setError(message);
    }
  };

  return {
    reopenPending: writePort.pending.reopen,
    reopenError: dialog.error,
    showReopenDialog: dialog.show,
    openReopenDialog: dialog.open,
    closeReopenDialog: dialog.close,
    handleRequestReopen: (reason: string | undefined) => {
      void requestReopen(reason);
    },
  };
}
