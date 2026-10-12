"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { mutationErrorMessage } from "../../../../shared/lib/errors/mutation-error-message";
import type { LeadFormGeneration } from "./lead-form-generation";
import type { LeadFormWritePort } from "./lead-form-write-port";
import { useGenerationState } from "./use-generation-state";

function useCommittedGenerationCapture(generation: LeadFormGeneration | null) {
  const activation = useMemo(() => ({ generation }), [generation]);
  const currentActivation = useRef<typeof activation | null>(null);

  useEffect(() => {
    currentActivation.current = activation;
    return () => {
      currentActivation.current = null;
    };
  }, [activation]);

  return useCallback(() => {
    return generation !== null && currentActivation.current === activation
      ? () => currentActivation.current === activation
      : null;
  }, [activation, generation]);
}

export function useLeadFormRevoke({
  generation,
  sectionIdForActions,
  onRevoked,
  writePort,
}: {
  readonly generation: LeadFormGeneration | null;
  readonly sectionIdForActions: string | null;
  readonly onRevoked: () => void;
  readonly writePort: LeadFormWritePort;
}) {
  const [showRevokeDialog, setShowRevokeDialog] = useGenerationState(
    generation,
    false,
  );
  const captureGeneration = useCommittedGenerationCapture(generation);

  const revoke = async () => {
    const isCurrent = captureGeneration();
    if (!sectionIdForActions || !isCurrent) return;
    try {
      await writePort.revoke({ reportSectionId: sectionIdForActions });
      if (!isCurrent()) return;
      onRevoked();
      toast.success("Section unlocked");
    } catch (error: unknown) {
      if (!isCurrent()) return;
      toast.error(mutationErrorMessage(error, "Revoke failed"));
    }
  };

  return {
    revokePending: writePort.pending.revoke,
    showRevokeDialog,
    cancelRevoke: () => setShowRevokeDialog(false),
    handleRevoke: () => setShowRevokeDialog(true),
    confirmRevoke: () => {
      setShowRevokeDialog(false);
      void revoke();
    },
  };
}
