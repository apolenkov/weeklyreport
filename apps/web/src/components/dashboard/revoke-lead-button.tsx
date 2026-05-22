"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

import { useTRPC } from "../../lib/trpc-context";
import { ConfirmationDialog } from "../ui/confirmation-dialog";

type RevokeSectionButtonProps = {
  readonly reportSectionId: string;
  readonly leadName: string;
};

/**
 * Per-lead Revoke button for the head dashboard (SC-160).
 *
 * Reuses the existing `leadForm.revoke` tRPC mutation — no new backend logic.
 * Shows a ConfirmationDialog before mutating; toasts on success or error.
 * Invalidates the `weeklyReport.get` query so the row reflects "Draft" state
 * without a manual refresh.
 */
export function RevokeSectionButton({
  reportSectionId,
  leadName,
}: RevokeSectionButtonProps): React.JSX.Element {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation(
    trpc.leadForm.revoke.mutationOptions({
      onSuccess: () => {
        toast.success(`${leadName}'s submission revoked.`);
        void queryClient.invalidateQueries(
          trpc.weeklyReport.get.queryOptions({}),
        );
      },
      onError: (err) => {
        toast.error(
          `Failed to revoke ${leadName}'s submission: ${err.message}`,
        );
      },
    }),
  );

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
        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-2 py-1 text-[12px] font-semibold text-[var(--color-foreground)] transition-colors hover:border-red-400 hover:text-red-600 disabled:cursor-default disabled:opacity-60"
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
        variant="revoke"
      />
    </>
  );
}
