import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toastMutationError } from "../../../shared/lib/errors/mutation-error-message";
import { invalidatePeriodLifecycle } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

interface PeriodReportMutations {
  readonly publish: (reportId: string, onSuccess: () => void) => void;
  readonly reopen: (reportId: string, onSuccess: () => void) => void;
  readonly isPublishOrReopenPending: boolean;
}

// Shared publish/reopen actions used by period controls and report pages.
export function usePeriodReportMutations(): PeriodReportMutations {
  const trpc = useTRPC();
  const qc = useQueryClient();

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
    publish: (reportId, onSuccess) =>
      publishMut.mutate({ reportId }, { onSuccess }),
    reopen: (reportId, onSuccess) =>
      reopenMut.mutate({ reportId }, { onSuccess }),
    isPublishOrReopenPending: publishMut.isPending || reopenMut.isPending,
  };
}
