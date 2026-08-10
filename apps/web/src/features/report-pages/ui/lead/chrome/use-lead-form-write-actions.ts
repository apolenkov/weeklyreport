"use client";

import { toast } from "sonner";

import {
  useLeadFormFillFrom,
  useLeadFormReopenRequest,
} from "../../../../period/client";
import type { LeadSubmitReadiness } from "../../../../report-sections";
import type {
  LeadFormGeneration,
  SubmitOutcome,
} from "../../../../report-sections";
import {
  useGenerationState,
  useLeadFormRevoke,
} from "../../../../report-sections/client";

interface UseLeadFormWriteActionsArgs {
  readonly generation: LeadFormGeneration | null;
  readonly sectionIdForActions: string | null;
  readonly autosaveDirty: boolean;
  readonly submitReadiness: LeadSubmitReadiness;
  readonly submit: () => Promise<SubmitOutcome>;
  readonly version: number;
  readonly setIsSubmitted: (next: boolean) => void;
  readonly handleConflict: () => void;
}

// Readiness is re-checked when the dialog is confirmed, not only when it
// opens: the draft can go stale while the confirmation sits on screen.
function useSubmitConfirmation({
  generation,
  submitReadiness,
  submit,
}: {
  readonly generation: LeadFormGeneration | null;
  readonly submitReadiness: LeadSubmitReadiness;
  readonly submit: () => Promise<SubmitOutcome>;
}) {
  const [showSubmitConfirm, setShowSubmitConfirm] = useGenerationState(
    generation,
    false,
  );

  const surfaceReadinessBlocker = () => {
    const issue = submitReadiness.blockingIssues.at(0);
    if (!issue) return;
    const message = issue.id.startsWith("risk-stage:")
      ? "Specify stages for at-risk/blocked products in Risks & Blockers."
      : issue.label;
    toast.error(message);
  };

  const handleSubmit = () => {
    if (!submitReadiness.canOpenConfirmation) {
      surfaceReadinessBlocker();
      return;
    }
    setShowSubmitConfirm(true);
  };

  const handleConfirmSubmit = () => {
    if (!submitReadiness.canOpenConfirmation) {
      setShowSubmitConfirm(false);
      surfaceReadinessBlocker();
      return;
    }
    void submit().then((outcome) => {
      if (outcome === "submitted") {
        setShowSubmitConfirm(false);
        toast.success("Report submitted");
      }
    });
  };

  return {
    showSubmitConfirm,
    setShowSubmitConfirm,
    handleSubmit,
    handleConfirmSubmit,
  };
}

// Dialog lifecycle (submit confirm, revoke, reopen, fill-from); draft owns state.
export function useLeadFormWriteActions({
  generation,
  sectionIdForActions,
  autosaveDirty,
  submitReadiness,
  submit,
  version,
  setIsSubmitted,
  handleConflict,
}: UseLeadFormWriteActionsArgs) {
  const revoke = useLeadFormRevoke({
    generation,
    sectionIdForActions,
    setIsSubmitted,
  });
  const reopen = useLeadFormReopenRequest({ generation, sectionIdForActions });
  const fillFrom = useLeadFormFillFrom({
    generation,
    sectionIdForActions,
    autosaveDirty,
    version,
    handleConflict,
  });
  const submitConfirmation = useSubmitConfirmation({
    generation,
    submitReadiness,
    submit,
  });

  return {
    ...revoke,
    ...reopen,
    ...fillFrom,
    ...submitConfirmation,
    submitPending: submitReadiness.submitPending,
  };
}
