"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
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
import type { LeadFormWritePort } from "../../../../report-sections/client";
import {
  useGenerationState,
  useLeadFormRevoke,
} from "../../../../report-sections/client";
import type { LeadFormDialogsWriteActions } from "./lead-form-dialogs";
import type { LeadFormHeaderWriteActions } from "./lead-form-header-actions";

export type LeadFormWriteActions = LeadFormDialogsWriteActions &
  LeadFormHeaderWriteActions & { readonly handleSubmit: () => void };

interface UseLeadFormWriteActionsArgs {
  readonly generation: LeadFormGeneration | null;
  readonly sectionIdForActions: string | null;
  readonly autosaveDirty: boolean;
  readonly submitReadiness: LeadSubmitReadiness;
  readonly submit: () => Promise<SubmitOutcome>;
  readonly version: number;
  readonly onRevoked: () => void;
  readonly onConflict: () => void;
  readonly adoptServerSection: (section: ReportSectionReadModel) => void;
  readonly writePort: LeadFormWritePort;
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
    cancelSubmit: () => setShowSubmitConfirm(false),
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
  onRevoked,
  onConflict,
  adoptServerSection,
  writePort,
}: UseLeadFormWriteActionsArgs): LeadFormWriteActions {
  const revoke = useLeadFormRevoke({
    generation,
    sectionIdForActions,
    onRevoked,
    writePort,
  });
  const reopen = useLeadFormReopenRequest({
    generation,
    sectionIdForActions,
    writePort,
  });
  const fillFrom = useLeadFormFillFrom({
    generation,
    sectionIdForActions,
    autosaveDirty,
    version,
    onConflict,
    onFilled: adoptServerSection,
    writePort,
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
