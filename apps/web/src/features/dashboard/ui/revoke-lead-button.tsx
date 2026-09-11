"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  invalidateLeadForm,
  invalidateLeadHistory,
  invalidateSubmissionDashboard,
} from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";

interface RevokeLeadButtonProps {
  readonly reportSectionId: string;
  readonly leadName: string;
  readonly onMutated: () => void;
}

function useRevokeMutation(leadName: string, onMutated: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.leadForm.revoke.mutationOptions({
      onSuccess: () => {
        toast.success(`${leadName}'s submission revoked.`);
        invalidateSubmissionDashboard(queryClient, trpc);
        invalidateLeadForm(queryClient, trpc);
        invalidateLeadHistory(queryClient, trpc);
        onMutated();
      },
      onError: (err) => {
        toast.error(
          `Failed to revoke ${leadName}'s submission: ${err.message}`,
        );
      },
    }),
  );
}

export function RevokeLeadButton({
  reportSectionId,
  leadName,
  onMutated,
}: RevokeLeadButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const mutation = useRevokeMutation(leadName, onMutated);

  const handleConfirm = (): void => {
    setOpen(false);
    mutation.mutate({ reportSectionId });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={mutation.isPending}
        aria-busy={mutation.isPending}
        aria-label={`Revoke ${leadName}'s submission`}
        title={`Revoke ${leadName}'s submission`}
        data-testid="revoke-lead-button"
        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-[12px] font-semibold text-[var(--color-foreground)] transition-colors hover:border-[color-mix(in_srgb,var(--color-destructive)_60%,transparent)] hover:text-[var(--color-destructive)] disabled:cursor-default disabled:opacity-60 max-md:min-h-[var(--touch-target-min)]"
      >
        <RotateCcw size={12} strokeWidth={2} aria-hidden="true" />
        <span>{mutation.isPending ? "Revoking…" : "Revoke"}</span>
      </button>

      <ConfirmationDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Revoke Submission?"
        description={`Revoke ${leadName}'s submission? Their form returns to Draft status.`}
        confirmLabel="Revoke"
        variant="destructive"
      />
    </>
  );
}
