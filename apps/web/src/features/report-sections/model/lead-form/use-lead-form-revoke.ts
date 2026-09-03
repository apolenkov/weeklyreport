"use client";

import { toast } from "sonner";

import type { LeadFormGeneration } from "./lead-form-generation";
import type { LeadFormWritePort } from "./lead-form-write-port";
import { useGenerationState } from "./use-generation-state";

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

  const revoke = async () => {
    if (!sectionIdForActions) return;
    try {
      await writePort.revoke({ reportSectionId: sectionIdForActions });
      onRevoked();
      toast.success("Section unlocked");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Revoke failed";
      toast.error(message);
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
