"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../lib/cache-keys";
import { isConflictError } from "../../../lib/trpc";
import { useTRPC } from "../../../lib/trpc-context";
import type { LeadSubmitReadiness } from "../../report-sections";
import type { SubmitOutcome } from "./lead-form-submit-context";

interface UseLeadFormWriteActionsArgs {
  readonly sectionIdForActions: string;
  readonly autosaveDirty: boolean;
  readonly submitReadiness: LeadSubmitReadiness;
  readonly submit: () => Promise<SubmitOutcome>;
  readonly version: number;
  readonly setIsSubmitted: (next: boolean) => void;
  readonly handleConflict: () => void;
}

// Dialog lifecycle (submit confirm, revoke, reopen, fill-from); draft owns state.
/**
 * Use Lead Form Write Actions.
 * @param props - The props argument.
 */
export function useLeadFormWriteActions({
  sectionIdForActions,
  autosaveDirty,
  submitReadiness,
  submit,
  version,
  setIsSubmitted,
  handleConflict,
}: UseLeadFormWriteActionsArgs) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);

  const revokeMut = useMutation(
    trpc.leadForm.revoke.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        invalidateDashboard(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        setIsSubmitted(false);
        toast.success("Section unlocked");
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Revoke failed";
        toast.error(msg);
      },
    }),
  );

  const requestReopenMut = useMutation(
    trpc.leadForm.requestReopen.mutationOptions({
      onSuccess: () => {
        setShowReopenDialog(false);
        setReopenError(null);
        invalidateLeadForm(qc, trpc);
        toast.success("Reopen request sent to Head");
      },
      onError: (err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Reopen request failed";
        setReopenError(msg);
      },
    }),
  );

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

  const handleRevoke = () => {
    setShowRevokeDialog(true);
  };

  const confirmRevoke = () => {
    setShowRevokeDialog(false);
    if (!sectionIdForActions) return;
    revokeMut.mutate({ reportSectionId: sectionIdForActions });
  };

  const openReopenDialog = () => {
    setReopenError(null);
    setShowReopenDialog(true);
  };

  const handleRequestReopen = (reason: string | undefined) => {
    if (!sectionIdForActions) return;
    requestReopenMut.mutate({
      reportSectionId: sectionIdForActions,
      ...(reason ? { reason } : {}),
    });
  };

  const closeReopenDialog = () => {
    setShowReopenDialog(false);
    setReopenError(null);
  };

  const handleFillFrom = (sourceSectionId: string) => {
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
  };

  return {
    confirmRevoke,
    fillFromMut,
    handleConfirmSubmit,
    handleFillFrom,
    handleRequestReopen,
    handleRevoke,
    handleSubmit,
    openReopenDialog,
    closeReopenDialog,
    reopenError,
    requestReopenMut,
    revokeMut,
    setShowRevokeDialog,
    setShowSubmitConfirm,
    showReopenDialog,
    showRevokeDialog,
    showSubmitConfirm,
    submitPending: submitReadiness.submitPending,
  };
}
