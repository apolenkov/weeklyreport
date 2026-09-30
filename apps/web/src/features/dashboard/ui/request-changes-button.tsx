"use client";

import { useQueryClient } from "@tanstack/react-query";
import { MessageSquareWarning } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateReview } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { RequestChangesDialog } from "../../review";

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
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-destructive)] transition-colors hover:border-[var(--color-destructive)]"
      >
        <MessageSquareWarning aria-hidden="true" className="h-3.5 w-3.5" />
        Request Changes
      </button>
      {open ? (
        <RequestChangesDialog
          reportSectionId={reportSectionId}
          version={version}
          subjectName={leadName}
          onClose={() => setOpen(false)}
          onRequested={() => {
            toast.success(
              `Changes requested from ${leadName.replace(/\.$/u, "")}.`,
            );
            invalidateReview(queryClient, trpc);
            onMutated();
          }}
        />
      ) : null}
    </>
  );
}
