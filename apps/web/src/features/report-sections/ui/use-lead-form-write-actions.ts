"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  computeCoupling,
  validateCoupling,
} from "../../../hooks/use-status-risk";
import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../lib/cache-keys";
import { isConflictError } from "../../../lib/trpc";
import { useTRPC } from "../../../lib/trpc-context";
import type { sectionToDraftPayload } from "../model/lead-section-draft-payload";
import type { Product, RiskEntry } from "../model/types";

type DraftPayload = ReturnType<typeof sectionToDraftPayload>;

interface UseLeadFormWriteActionsArgs {
  readonly sectionIdForActions: string;
  readonly autosaveDirty: boolean;
  readonly getSubmitContext: () => {
    readonly draftPayload: DraftPayload | null;
    readonly products: readonly Product[];
    readonly ownRisks: readonly RiskEntry[];
  };
  readonly versionRef: { readonly current: number };
  readonly setVersionSafe: (next: number) => void;
  readonly setIsSubmitted: (next: boolean) => void;
  readonly handleConflict: () => void;
}

function hasMissingRiskStageCoupling(
  products: readonly Product[],
  ownRisks: readonly RiskEntry[],
): boolean {
  const committedRisks = ownRisks.filter(
    (risk) => risk.text.trim().length > 0 && risk.mitigation.trim().length > 0,
  );
  const coupling = computeCoupling(products, committedRisks);
  const { missing } = validateCoupling(coupling);
  return missing.length > 0;
}

function buildSubmitPayload(draftPayload: DraftPayload, version: number) {
  const projectStatuses = draftPayload.projectStatuses.map((project) => ({
    projectId: project.projectId,
    status: project.status ?? ("green" as const),
  }));
  const activityStatuses = (draftPayload.activityStatuses ?? []).map(
    (activity) => ({
      activityId: activity.activityId,
      status: activity.status ?? ("green" as const),
      note: activity.note ?? null,
    }),
  );
  const stageStatuses = (draftPayload.stageStatuses ?? []).map((stage) => ({
    ...stage,
    status:
      stage.status == null ||
      stage.status === "red" ||
      stage.status === "yellow"
        ? ("green" as const)
        : stage.status,
  }));

  return {
    ...draftPayload,
    version,
    projectStatuses,
    activityStatuses,
    stageStatuses,
    confirmed: true as const,
  };
}

export function useLeadFormWriteActions({
  sectionIdForActions,
  autosaveDirty,
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

  const handleSubmit = () => {
    const { products, ownRisks } = getSubmitContext();
    if (hasMissingRiskStageCoupling(products, ownRisks)) {
      toast.error(
        "Specify stages for at-risk/blocked products in Risks & Blockers.",
      );
      return;
    }
    setShowSubmitConfirm(true);
  };

  const handleConfirmSubmit = () => {
    const { draftPayload } = getSubmitContext();
    if (!draftPayload) return;
    submitMut.mutate(buildSubmitPayload(draftPayload, versionRef.current));
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
