"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { AutosaveSnapshot } from "../../../../report-sections/client";

export const SAVE_FAILURE_TOAST_ID = "lead-draft-save-failed";

// The header Retry scrolls away with the page, so a failed autosave also stays
// pinned at the top of the viewport until the draft saves again.
export function useSaveFailureNotice(
  autosave: AutosaveSnapshot,
  enabled: boolean,
): void {
  const failed = enabled && autosave.state === "error";
  const { forceSave } = autosave;
  const raised = useRef(false);
  useEffect(() => {
    if (!failed) {
      if (raised.current) toast.dismiss(SAVE_FAILURE_TOAST_ID);
      raised.current = false;
      return;
    }
    raised.current = true;
    toast.error("Draft not saved", {
      id: SAVE_FAILURE_TOAST_ID,
      description: "Your latest changes are only in this tab.",
      duration: Number.POSITIVE_INFINITY,
      action: { label: "Retry", onClick: () => void forceSave() },
    });
  }, [failed, forceSave]);
  useEffect(
    () => () => {
      if (raised.current) toast.dismiss(SAVE_FAILURE_TOAST_ID);
    },
    [],
  );
}
