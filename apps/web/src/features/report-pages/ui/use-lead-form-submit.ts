"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from "react";
import { toast } from "sonner";

import { isConflictError } from "../../../shared/lib/trpc/trpc";
import {
  buildLeadSubmitPayload,
  deriveLeadSubmitReadiness,
  mapLeadRisks,
} from "../../report-sections";
import type { DraftSaveContent } from "../../report-sections/client";
import type { LeadFormDraftSeam } from "./lead-form-draft-seam";
import {
  buildSubmitStages,
  type SubmitOutcome,
} from "./lead-form-submit-context";

type ReadinessInput = Parameters<typeof deriveLeadSubmitReadiness>[0];

interface LeadSubmitReadinessArgs {
  readonly draftSection: ReportSectionReadModel | null;
  readonly draftPayload: DraftSaveContent | null;
  readonly products: ReadinessInput["products"];
  readonly autosaveState: ReadinessInput["autosaveState"];
  readonly submitPending: boolean;
}

// The gate reads the LIVE draft, so a lead sees readiness before autosave lands.
export function buildLeadSubmitReadiness({
  draftSection,
  draftPayload,
  products,
  autosaveState,
  submitPending,
}: LeadSubmitReadinessArgs) {
  return deriveLeadSubmitReadiness({
    draftPayload,
    products,
    activities: (draftSection?.activities ?? []).map((activity) => ({
      id: activity.activityId,
      name: activity.activityName,
    })),
    stages: buildSubmitStages(draftPayload, products),
    ownRisks: draftSection ? mapLeadRisks(draftSection) : [],
    autosaveState,
    submitPending,
  });
}

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
