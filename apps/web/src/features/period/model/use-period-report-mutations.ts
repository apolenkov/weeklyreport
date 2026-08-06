import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { mutationErrorMessage } from "../../../shared/lib/errors/mutation-error-message";
import { invalidatePeriodLifecycle } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

function toastMutationError(fallbackMessage: string) {
  return (err: unknown) => {
    toast.error(mutationErrorMessage(err, fallbackMessage));
  };
}

interface PeriodReportMutations {
  readonly publish: (reportId: string) => void;
  readonly reopen: (reportId: string) => void;
  readonly isPublishOrReopenPending: boolean;
}

// Publish and reopen are period lifecycle transitions; archive actions stay in
// the report-page adapter because they also invalidate the dashboard listing.
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
    publish: (reportId) => publishMut.mutate({ reportId }),
    reopen: (reportId) => reopenMut.mutate({ reportId }),
    isPublishOrReopenPending: publishMut.isPending || reopenMut.isPending,
  };
}
