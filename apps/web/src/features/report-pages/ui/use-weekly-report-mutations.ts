import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

// Publish and reopen both change what every report surface shows, so they bust
// the same three caches; archive only affects the dashboard/archive list.
function invalidateReportViews(
  ...args: Parameters<typeof invalidateDashboard>
): void {
  invalidateDashboard(...args);
  invalidateLeadForm(...args);
  invalidateLeadHistory(...args);
}

function toastMutationError(fallbackMessage: string) {
  return (err: unknown) => {
    toast.error(err instanceof Error ? err.message : fallbackMessage);
  };
}

export interface WeeklyReportMutations {
  readonly publish: (reportId: string) => void;
  readonly reopen: (reportId: string) => void;
  readonly archive: (reportId: string) => void;
  readonly isPublishOrReopenPending: boolean;
  readonly isArchivePending: boolean;
}

// Publish/reopen/archive with cascading invalidation on success.
/**
 * Use Weekly Report Mutations.
 */
export function useWeeklyReportMutations(): WeeklyReportMutations {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const publishMut = useMutation(
    trpc.period.publish.mutationOptions({
      onSuccess: () => {
        invalidateReportViews(qc, trpc);
        toast.success("Period published & locked");
      },
      onError: toastMutationError("Failed to publish period"),
    }),
  );

  const reopenMut = useMutation(
    trpc.period.reopen.mutationOptions({
      onSuccess: () => {
        invalidateReportViews(qc, trpc);
        toast.success("Period reopened");
      },
      onError: toastMutationError("Failed to reopen period"),
    }),
  );

  // Archive mutation — head moves a published report into the archive so it
  // appears in archive.list. Only visible when periodStatus==='published'.
  const archiveMut = useMutation(
    trpc.archive.archiveReport.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        toast.success("Report archived");
      },
      onError: toastMutationError("Failed to archive report"),
    }),
  );

  return {
    publish: (reportId) => publishMut.mutate({ reportId }),
    reopen: (reportId) => reopenMut.mutate({ reportId }),
    archive: (reportId) => archiveMut.mutate({ reportId }),
    isPublishOrReopenPending: publishMut.isPending || reopenMut.isPending,
    isArchivePending: archiveMut.isPending,
  };
}
