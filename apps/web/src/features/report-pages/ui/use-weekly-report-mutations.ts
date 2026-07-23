import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";

export interface WeeklyReportMutations {
  readonly publish: (reportId: string) => void;
  readonly reopen: (reportId: string) => void;
  readonly archive: (reportId: string) => void;
  readonly isPublishOrReopenPending: boolean;
  readonly isArchivePending: boolean;
}

/**
 * The report's three lifecycle mutations (publish/reopen/archive), each
 * cascading cache invalidation across the surfaces that must refetch on
 * success. Extracted so the controller hook stays under the complexity
 * budget.
 */
export function useWeeklyReportMutations(): WeeklyReportMutations {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const publishMut = useMutation(
    trpc.period.publish.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        invalidateLeadForm(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        toast.success("Period published & locked");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to publish period",
        );
      },
    }),
  );

  const reopenMut = useMutation(
    trpc.period.reopen.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        invalidateLeadForm(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        toast.success("Period reopened");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to reopen period",
        );
      },
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
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to archive report",
        );
      },
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
