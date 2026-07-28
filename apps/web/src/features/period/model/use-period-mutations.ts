"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  invalidateAdmin,
  invalidatePeriodLifecycle,
} from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

// Server messages pipe through verbatim (overlap ranges, policy rejections, etc.).
function notifyError(err: { readonly message: string }) {
  toast.error(err.message);
}

type NotifyDone = (
  message: string,
  closeDialog?: () => void,
  invalidatesReportViews?: boolean,
) => () => void;

function usePeriodDoneNotifier(): NotifyDone {
  const trpc = useTRPC();
  const qc = useQueryClient();

  return (message, closeDialog, invalidatesReportViews = false) =>
    () => {
      void qc.invalidateQueries(trpc.admin.listPeriodsByState.pathFilter());
      invalidateAdmin(qc, trpc);
      if (invalidatesReportViews) invalidatePeriodLifecycle(qc, trpc);
      toast.success(message);
      closeDialog?.();
    };
}

// Lifecycle transitions of an existing period; no dialog to dismiss.
function usePeriodStateMutations(notifyDone: NotifyDone) {
  const trpc = useTRPC();

  return {
    publishMut: useMutation(
      trpc.period.publish.mutationOptions({
        onSuccess: notifyDone("Period published", undefined, true),
        onError: notifyError,
      }),
    ),
    reopenMut: useMutation(
      trpc.period.reopen.mutationOptions({
        onSuccess: notifyDone("Period reopened", undefined, true),
        onError: notifyError,
      }),
    ),
    archiveMut: useMutation(
      trpc.admin.archivePeriod.mutationOptions({
        onSuccess: notifyDone("Period archived"),
        onError: notifyError,
      }),
    ),
    unarchiveMut: useMutation(
      trpc.admin.unarchivePeriod.mutationOptions({
        onSuccess: notifyDone("Period unarchived"),
        onError: notifyError,
      }),
    ),
  };
}

// Record edits driven from a dialog, which the injected callback closes.
function usePeriodRecordMutations(
  notifyDone: NotifyDone,
  onCreateSuccess: () => void,
  onEditSuccess: () => void,
  onDeleteSuccess: () => void,
) {
  const trpc = useTRPC();

  return {
    createMut: useMutation(
      trpc.admin.createPeriodManual.mutationOptions({
        onSuccess: notifyDone("Period created", onCreateSuccess),
        onError: notifyError,
      }),
    ),
    updateMut: useMutation(
      trpc.admin.updatePeriodManual.mutationOptions({
        onSuccess: notifyDone("Period updated", onEditSuccess),
        onError: notifyError,
      }),
    ),
    deleteMut: useMutation(
      trpc.admin.deleteReport.mutationOptions({
        onSuccess: notifyDone("Period deleted", onDeleteSuccess),
        onError: notifyError,
      }),
    ),
  };
}

// Periods-tab lifecycle mutations; dialog close via injected success callbacks.
export function usePeriodMutations({
  onCreateSuccess,
  onEditSuccess,
  onDeleteSuccess,
}: {
  readonly onCreateSuccess: () => void;
  readonly onEditSuccess: () => void;
  readonly onDeleteSuccess: () => void;
}) {
  const notifyDone = usePeriodDoneNotifier();
  const stateMutations = usePeriodStateMutations(notifyDone);
  const recordMutations = usePeriodRecordMutations(
    notifyDone,
    onCreateSuccess,
    onEditSuccess,
    onDeleteSuccess,
  );

  return { ...stateMutations, ...recordMutations };
}
