"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import type { AutosaveState } from "../../../hooks/use-lead-form-autosave";
import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../lib/cache-keys";
import { isConflictError } from "../../../lib/trpc";
import { useTRPC } from "../../../lib/trpc-context";
import type { sectionToDraftPayload } from "../model/lead-section-draft-payload";
import {
  buildLeadSubmitPayload,
  deriveLeadSubmitReadiness,
} from "../model/lead-submit-readiness";
import type { Product, RiskEntry } from "../model/types";

type DraftPayload = ReturnType<typeof sectionToDraftPayload>;

interface UseLeadFormWriteActionsArgs {
  readonly sectionIdForActions: string;
  readonly autosaveDirty: boolean;
  readonly autosaveState: AutosaveState;
  readonly getSubmitContext: () => {
    readonly draftPayload: DraftPayload | null;
    readonly products: readonly Product[];
    readonly activities: readonly { id: string; name: string }[];
    readonly stages: readonly {
      projectId: string;
      stageId: string;
      name: string;
    }[];
    readonly ownRisks: readonly RiskEntry[];
  };
  readonly versionRef: { readonly current: number };
  readonly setVersionSafe: (next: number) => void;
  readonly setIsSubmitted: (next: boolean) => void;
  readonly handleConflict: () => void;
}

export function useLeadFormWriteActions({
  sectionIdForActions,
  autosaveDirty,
  autosaveState,
  getSubmitContext,
  versionRef,
  setVersionSafe,
  setIsSubmitted,
  handleConflict,
}: UseLeadFormWriteActionsArgs) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);

  const submitMut = useMutation(
    trpc.reports.submit.mutationOptions({
      onSuccess: (saved) => {
        setVersionSafe(saved.version);
        invalidateLeadForm(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        setIsSubmitted(true);
        setShowSubmitConfirm(false);
        toast.success("Report submitted");
      },
      onError: (err: unknown) => {
        if (isConflictError(err)) {
          handleConflict();
          return;
        }
        if (err instanceof Error) {
          toast.error(err.message);
        } else {
          toast.error("Submit failed");
        }
      },
    }),
  );

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

  const getSubmitReadiness = () =>
    deriveLeadSubmitReadiness({
      ...getSubmitContext(),
      autosaveState,
      submitPending: submitMut.isPending,
    });

  const surfaceReadinessBlocker = () => {
    const issue = getSubmitReadiness().blockingIssues.at(0);
    if (!issue) return;
    const message = issue.id.startsWith("risk-stage:")
      ? "Specify stages for at-risk/blocked products in Risks & Blockers."
      : issue.label;
    toast.error(message);
  };

  const handleSubmit = () => {
    const readiness = getSubmitReadiness();
    if (!readiness.canOpenConfirmation) {
      surfaceReadinessBlocker();
      return;
    }
    setShowSubmitConfirm(true);
  };

  const handleConfirmSubmit = () => {
    const readiness = getSubmitReadiness();
    if (!readiness.canOpenConfirmation) {
      setShowSubmitConfirm(false);
      surfaceReadinessBlocker();
      return;
    }
    const { draftPayload } = getSubmitContext();
    if (!draftPayload) return;
    submitMut.mutate(buildLeadSubmitPayload(draftPayload, versionRef.current));
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
      version: versionRef.current,
    });
  };

  return {
    confirmRevoke,
    fillFromMut,
    getSubmitReadiness,
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
    submitMut,
  };
}
