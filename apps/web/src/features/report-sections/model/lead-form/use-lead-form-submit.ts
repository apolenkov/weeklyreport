"use client";

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from "react";
import { toast } from "sonner";

import { isConflictError } from "../../../../shared/lib/trpc/trpc";
import type { DraftSaveContent } from "../lead-section-draft-payload";
import { buildLeadSubmitPayload } from "../lead-submit-readiness";
import type { LeadFormDraftSeam } from "./lead-form-draft-seam";
import type { SubmitOutcome } from "./lead-form-submit-context";

interface LeadFormSubmitArgs {
  readonly draftPayload: DraftSaveContent | null;
  readonly seam: LeadFormDraftSeam;
  readonly versionRef: RefObject<number>;
  readonly setVersionSafe: (next: number) => void;
  readonly setIsSubmitted: Dispatch<SetStateAction<boolean>>;
  readonly handleConflict: () => void;
}

export function useLeadFormSubmit({
  draftPayload,
  seam,
  versionRef,
  setVersionSafe,
  setIsSubmitted,
  handleConflict,
}: LeadFormSubmitArgs) {
  return useCallback(async (): Promise<SubmitOutcome> => {
    const payload = draftPayload;
    if (!payload) return "no-draft";
    try {
      const saved = await seam.submitSection(
        buildLeadSubmitPayload(payload, versionRef.current),
      );
      setVersionSafe(saved.version);
      setIsSubmitted(true);
      seam.onSubmitSuccess();
      return "submitted";
    } catch (error: unknown) {
      if (isConflictError(error)) {
        handleConflict();
        return "conflict";
      }
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Submit failed",
      );
      return "error";
    }
  }, [
    draftPayload,
    seam,
    versionRef,
    setVersionSafe,
    setIsSubmitted,
    handleConflict,
  ]);
}
