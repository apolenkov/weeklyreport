import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { mutationErrorMessage } from "../../../shared/lib/errors/mutation-error-message";
import { invalidateDashboard } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { usePeriodReportMutations } from "../../period/client";

function toastMutationError(fallbackMessage: string) {
  return (err: unknown) => {
    toast.error(mutationErrorMessage(err, fallbackMessage));
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

// Archive and its inverse belong to the page adapter: they move a report
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

// Compose page archive actions with the period-owned publish/reopen seam.
export function useWeeklyReportMutations(): WeeklyReportMutations {
  const periodMutations = usePeriodReportMutations();
  const { archiveMut, restoreMut } = useArchiveMutations();

  return {
    publish: periodMutations.publish,
    reopen: periodMutations.reopen,
    archive: (reportId) => archiveMut.mutate({ reportId }),
    restore: (reportId) => restoreMut.mutate({ reportId }),
    isPublishOrReopenPending: periodMutations.isPublishOrReopenPending,
    isArchivePending: archiveMut.isPending,
    isRestorePending: restoreMut.isPending,
  };
}
