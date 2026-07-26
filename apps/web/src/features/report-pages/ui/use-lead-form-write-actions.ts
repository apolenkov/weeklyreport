"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { LeadSubmitReadiness } from "../../report-sections";
import type { SubmitOutcome } from "./lead-form-submit-context";
import { useLeadFormFillFrom } from "./use-lead-form-fill-from";
import { useLeadFormReopenRequest } from "./use-lead-form-reopen-request";
import { useLeadFormRevoke } from "./use-lead-form-revoke";

interface UseLeadFormWriteActionsArgs {
  readonly sectionIdForActions: string;
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
  submitReadiness,
  submit,
}: {
  readonly submitReadiness: LeadSubmitReadiness;
  readonly submit: () => Promise<SubmitOutcome>;
}) {
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

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
  sectionIdForActions,
  autosaveDirty,
  submitReadiness,
  submit,
  version,
  setIsSubmitted,
  handleConflict,
}: UseLeadFormWriteActionsArgs) {
  const revoke = useLeadFormRevoke({ sectionIdForActions, setIsSubmitted });
  const reopen = useLeadFormReopenRequest({ sectionIdForActions });
  const fillFrom = useLeadFormFillFrom({
    sectionIdForActions,
    autosaveDirty,
    version,
    handleConflict,
  });
  const submitConfirmation = useSubmitConfirmation({ submitReadiness, submit });

  return {
    ...revoke,
    ...reopen,
    ...fillFrom,
    ...submitConfirmation,
    submitPending: submitReadiness.submitPending,
  };
}
