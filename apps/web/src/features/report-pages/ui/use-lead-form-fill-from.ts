"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateLeadForm } from "../../../lib/cache-keys";
import { isConflictError } from "../../../lib/trpc";
import { useTRPC } from "../../../lib/trpc-context";

export function useLeadFormFillFrom({
  sectionIdForActions,
  autosaveDirty,
  version,
  handleConflict,
}: {
  readonly sectionIdForActions: string;
  readonly autosaveDirty: boolean;
  readonly version: number;
  readonly handleConflict: () => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const fillFromMut = useMutation(
    trpc.leadForm.fillFrom.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        toast.success("Form filled from selected period");
      },
      onError: (err: unknown) => {
        if (isConflictError(err)) {
          handleConflict();
          return;
        }
        const msg = err instanceof Error ? err.message : "Fill from failed";
        toast.error(msg);
      },
    }),
  );

  return {
    fillFromMut,
    // Fill replaces the whole draft, so unsaved local edits need an explicit
    // go-ahead before they are overwritten.
    handleFillFrom: (sourceSectionId: string) => {
      if (!sectionIdForActions) return;
      if (
        autosaveDirty &&
        !window.confirm("You have unsaved changes. Continue and overwrite?")
      ) {
        return;
      }
      fillFromMut.mutate({
        targetSectionId: sectionIdForActions,
        sourceSectionId,
        version,
      });
    },
  };
}
