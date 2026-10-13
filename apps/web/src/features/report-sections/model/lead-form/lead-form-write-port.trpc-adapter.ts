"use client";

import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
  invalidateLeadPlanOutcome,
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
  sectionOf: (input: Input) => string,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [requests, setRequests] = useState<
    readonly { readonly sectionId: string | null; readonly token: symbol }[]
  >([]);
  const write = useCallback(
    async (input: Input): Promise<Output> => {
      const attempt = {
        sectionId: sectionOf(input) || null,
        token: Symbol("section-write"),
      };
      setRequests((current) => [...current, attempt]);
      try {
        const result = await mutation.mutateAsync(input);
        invalidate(queryClient, trpc);
        return result;
      } catch (error: unknown) {
        throw normalizeWriteError(error);
      } finally {
        setRequests((current) =>
          current.filter((request) => request.token !== attempt.token),
        );
      }
    },
    [invalidate, mutation, queryClient, sectionOf, trpc],
  );
  const pendingIn = (sectionId: string | null): boolean =>
    requests.some(
      (request) =>
        sectionId === null ||
        request.sectionId === null ||
        request.sectionId === sectionId,
    );
  return { write, pendingIn };
}

const reportSectionOf = (input: { readonly reportSectionId: string }) =>
  input.reportSectionId;
const fillTargetOf = (input: { readonly targetSectionId: string }) =>
  input.targetSectionId;

// Production adapter at the owned-network seam. Transport details and cache
// invalidation stay here; the editor implementation owns workflow decisions.
export function useLeadFormWritePort(
  sectionId: string | null,
): LeadFormWritePort {
  const trpc = useTRPC();
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

  const saveDraft = useWrite(
    useMutation(trpc.reports.saveDraft.mutationOptions({})),
    invalidateForm,
    reportSectionOf,
  );
  const submit = useWrite(
    submitMutation,
    invalidateFormDashboardHistory,
    reportSectionOf,
  );
  const resolvePlan = useWrite(
    resolvePlanMutation,
    invalidateLeadPlanOutcome,
    reportSectionOf,
  );
  const restorePlan = useWrite(
    restorePlanMutation,
    invalidateLeadPlanOutcome,
    reportSectionOf,
  );
  const promotePlan = useWrite(
    promotePlanMutation,
    invalidateLeadPlanOutcome,
    reportSectionOf,
  );
  const fillFrom = useWrite(fillFromMutation, invalidateForm, fillTargetOf);
  const revoke = useWrite(
    revokeMutation,
    invalidateFormDashboardHistory,
    reportSectionOf,
  );
  const requestReopen = useWrite(
    reopenMutation,
    invalidateForm,
    reportSectionOf,
  );

  return {
    pending: {
      saveDraft: saveDraft.pendingIn(sectionId),
      submit: submit.pendingIn(sectionId),
      resolvePlan: resolvePlan.pendingIn(sectionId),
      restorePlan: restorePlan.pendingIn(sectionId),
      promotePlan: promotePlan.pendingIn(sectionId),
      fillFrom: fillFrom.pendingIn(sectionId),
      revoke: revoke.pendingIn(sectionId),
      reopen: requestReopen.pendingIn(sectionId),
    },
    saveDraft: saveDraft.write,
    submit: submit.write,
    resolvePlan: resolvePlan.write,
    restorePlan: restorePlan.write,
    promotePlan: promotePlan.write,
    fillFrom: fillFrom.write,
    revoke: revoke.write,
    requestReopen: requestReopen.write,
  };
}
