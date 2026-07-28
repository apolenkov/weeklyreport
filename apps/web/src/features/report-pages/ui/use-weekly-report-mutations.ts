import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  invalidateDashboard,
  invalidatePeriodLifecycle,
} from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

function toastMutationError(fallbackMessage: string) {
  return (err: unknown) => {
    toast.error(err instanceof Error ? err.message : fallbackMessage);
  };
}

export interface WeeklyReportMutations {
  readonly publish: (reportId: string) => void;
  readonly reopen: (reportId: string) => void;
  readonly archive: (reportId: string) => void;
  readonly restore: (reportId: string) => void;
  readonly isPublishOrReopenPending: boolean;
  readonly isArchivePending: boolean;
  readonly isRestorePending: boolean;
}

// Archive and its inverse bust the same caches: both only move a report
// between the live dashboard and the archive list.
function useArchiveMutations() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const onArchivalSuccess = (message: string) => () => {
    invalidateDashboard(qc, trpc);
    toast.success(message);
  };

  return {
    archiveMut: useMutation(
      trpc.archive.archiveReport.mutationOptions({
        onSuccess: onArchivalSuccess("Report archived"),
        onError: toastMutationError("Failed to archive report"),
      }),
    ),
    restoreMut: useMutation(
      trpc.archive.unarchiveReport.mutationOptions({
        onSuccess: onArchivalSuccess("Report restored"),
        onError: toastMutationError("Failed to restore report"),
      }),
    ),
  };
}

// Publish/reopen/archive/restore with cascading invalidation on success.
export function useWeeklyReportMutations(): WeeklyReportMutations {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { archiveMut, restoreMut } = useArchiveMutations();

  const publishMut = useMutation(
    trpc.period.publish.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLifecycle(qc, trpc);
        toast.success("Period published & locked");
      },
      onError: toastMutationError("Failed to publish period"),
    }),
  );

  const reopenMut = useMutation(
    trpc.period.reopen.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLifecycle(qc, trpc);
        toast.success("Period reopened");
      },
      onError: toastMutationError("Failed to reopen period"),
    }),
  );

  return {
    publish: (reportId) => publishMut.mutate({ reportId }),
    reopen: (reportId) => reopenMut.mutate({ reportId }),
    archive: (reportId) => archiveMut.mutate({ reportId }),
    restore: (reportId) => restoreMut.mutate({ reportId }),
    isPublishOrReopenPending: publishMut.isPending || reopenMut.isPending,
    isArchivePending: archiveMut.isPending,
    isRestorePending: restoreMut.isPending,
  };
}
