"use client";

import { type ReactNode, useState } from "react";

import { ConfirmationDialog } from "./confirmation-dialog";

// Routes every dismissal (Escape, backdrop, Cancel) through a "Discard
// changes?" confirmation while the draft is dirty; a clean draft closes at once
// and an in-flight save ignores dismissal.
export function useDiscardGuard(
  isDirty: boolean,
  onDiscard: () => void,
  isPending = false,
): { readonly requestClose: () => void; readonly discardDialog: ReactNode } {
  const [isAsking, setIsAsking] = useState(false);
  return {
    requestClose: isPending
      ? () => undefined
      : isDirty
        ? () => setIsAsking(true)
        : onDiscard,
    discardDialog: (
      <ConfirmationDialog
        open={isAsking}
        onClose={() => setIsAsking(false)}
        onConfirm={onDiscard}
        title="Discard changes?"
        description="Your unsaved changes will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="destructive"
        isPending={isPending}
      />
    ),
  };
}
