"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";

import { invalidateReview } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

interface RequestChangesButtonProps {
  readonly reportSectionId: string;
  readonly version: number;
  readonly leadName: string;
  readonly onMutated: () => void;
}

export function RequestChangesButton({
  reportSectionId,
  version,
  leadName,
  onMutated,
}: RequestChangesButtonProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const mutation = useMutation(
    trpc.review.verdict.mutationOptions({
      onSuccess: () => {
        toast.success(`Changes requested from ${leadName}.`);
        invalidateReview(queryClient, trpc);
        onMutated();
      },
      onError: (error) => {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : `Failed to request changes from ${leadName}.`,
        );
      },
    }),
  );

  return (
    <button
      type="button"
      onClick={() =>
        mutation.mutate({
          reportSectionId,
          verdict: "changes_requested",
          version,
        })
      }
      disabled={mutation.isPending}
      aria-busy={mutation.isPending}
      className="inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-destructive)] transition-colors hover:border-[var(--color-destructive)] disabled:cursor-default disabled:opacity-60"
    >
      <MessageSquareWarning aria-hidden="true" className="h-3.5 w-3.5" />
      {mutation.isPending ? "Requesting…" : "Request Changes"}
    </button>
  );
}
