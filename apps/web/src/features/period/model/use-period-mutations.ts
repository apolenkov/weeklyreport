"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidatePeriodLifecycle } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

// Server messages pipe through verbatim (overlap ranges, policy rejections, etc.).
function notifyError(err: { readonly message: string }) {
  toast.error(err.message);
}

type NotifyDone = (message: string, closeDialog?: () => void) => () => void;

function usePeriodDoneNotifier(): NotifyDone {
  const trpc = useTRPC();
  const qc = useQueryClient();

  return (message, closeDialog) => () => {
    invalidatePeriodLifecycle(qc, trpc);
    toast.success(message);
    closeDialog?.();
  };
}

// Reopen dismisses its confirmation only after the transition succeeds.
function usePeriodStateMutations(
  notifyDone: NotifyDone,
  onReopenSuccess: () => void,
) {
  const trpc = useTRPC();

  return {
    publishMut: useMutation(
      trpc.period.publish.mutationOptions({
        onSuccess: notifyDone("Period published"),
        onError: notifyError,
      }),
    ),
    reopenMut: useMutation(
      trpc.period.reopen.mutationOptions({
        onSuccess: notifyDone("Period reopened", onReopenSuccess),
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
  onReopenSuccess,
  onDeleteSuccess,
}: {
  readonly onCreateSuccess: () => void;
  readonly onEditSuccess: () => void;
  readonly onReopenSuccess: () => void;
  readonly onDeleteSuccess: () => void;
}) {
  const notifyDone = usePeriodDoneNotifier();
  const stateMutations = usePeriodStateMutations(notifyDone, onReopenSuccess);
  const recordMutations = usePeriodRecordMutations(
    notifyDone,
    onCreateSuccess,
    onEditSuccess,
    onDeleteSuccess,
  );

  return { ...stateMutations, ...recordMutations };
}
