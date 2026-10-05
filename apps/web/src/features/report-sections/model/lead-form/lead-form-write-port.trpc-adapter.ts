"use client";

import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../../shared/lib/query/cache-keys";
import { isConflictError } from "../../../../shared/lib/trpc/trpc";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import {
  LeadFormWriteError,
  type LeadFormWritePort,
} from "./lead-form-write-port";

function normalizeWriteError(error: unknown): LeadFormWriteError {
  const message =
    error instanceof Error && error.message ? error.message : "Write failed";
  return new LeadFormWriteError(
    isConflictError(error) ? "conflict" : "error",
    message,
  );
}

type Invalidate = (
  queryClient: QueryClient,
  trpc: ReturnType<typeof useTRPC>,
) => void;

const invalidateForm: Invalidate = (queryClient, trpc) => {
  invalidateLeadForm(queryClient, trpc);
};
const invalidateFormDashboardHistory: Invalidate = (queryClient, trpc) => {
  invalidateLeadForm(queryClient, trpc);
  invalidateDashboard(queryClient, trpc);
  invalidateLeadHistory(queryClient, trpc);
};

// One write: run the mutation, refresh the caches it touched, and surface only
// the normalized port error.
function useWrite<Input, Output>(
  mutation: { readonly mutateAsync: (input: Input) => Promise<Output> },
  invalidate: Invalidate,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useCallback(
    async (input: Input): Promise<Output> => {
      try {
        const result = await mutation.mutateAsync(input);
        invalidate(queryClient, trpc);
        return result;
      } catch (error: unknown) {
        throw normalizeWriteError(error);
      }
    },
    [invalidate, mutation, queryClient, trpc],
  );
}

// Production adapter at the owned-network seam. Transport details and cache
// invalidation stay here; the editor implementation owns workflow decisions.
export function useLeadFormWritePort(): LeadFormWritePort {
  const trpc = useTRPC();
  const saveDraftMutation = useMutation(
    trpc.reports.saveDraft.mutationOptions({}),
  );
  const submitMutation = useMutation(trpc.reports.submit.mutationOptions({}));
  const resolvePlanMutation = useMutation(
    trpc.leadForm.resolvePlan.mutationOptions({}),
  );
  const restorePlanMutation = useMutation(
    trpc.leadForm.restorePlan.mutationOptions({}),
  );
  const promotePlanMutation = useMutation(
    trpc.leadForm.promotePlan.mutationOptions({}),
  );
  const fillFromMutation = useMutation(
    trpc.leadForm.fillFrom.mutationOptions({}),
  );
  const revokeMutation = useMutation(trpc.leadForm.revoke.mutationOptions({}));
  const reopenMutation = useMutation(
    trpc.leadForm.requestReopen.mutationOptions({}),
  );

  const saveDraft = useWrite(saveDraftMutation, invalidateForm);
  const submit = useWrite(submitMutation, invalidateFormDashboardHistory);
  const resolvePlan = useWrite(resolvePlanMutation, invalidateForm);
  const restorePlan = useWrite(restorePlanMutation, invalidateForm);
  const promotePlan = useWrite(promotePlanMutation, invalidateForm);
  const fillFrom = useWrite(fillFromMutation, invalidateForm);
  const revoke = useWrite(revokeMutation, invalidateFormDashboardHistory);
  const requestReopen = useWrite(reopenMutation, invalidateForm);

  return useMemo(
    () => ({
      pending: {
        saveDraft: saveDraftMutation.isPending,
        submit: submitMutation.isPending,
        resolvePlan: resolvePlanMutation.isPending,
        restorePlan: restorePlanMutation.isPending,
        promotePlan: promotePlanMutation.isPending,
        fillFrom: fillFromMutation.isPending,
        revoke: revokeMutation.isPending,
        reopen: reopenMutation.isPending,
      },
      saveDraft,
      submit,
      resolvePlan,
      restorePlan,
      promotePlan,
      fillFrom,
      revoke,
      requestReopen,
    }),
    [
      fillFrom,
      fillFromMutation.isPending,
      promotePlan,
      promotePlanMutation.isPending,
      reopenMutation.isPending,
      requestReopen,
      resolvePlan,
      resolvePlanMutation.isPending,
      revoke,
      revokeMutation.isPending,
      saveDraft,
      saveDraftMutation.isPending,
      submit,
      submitMutation.isPending,
      restorePlan,
      restorePlanMutation.isPending,
    ],
  );
}
