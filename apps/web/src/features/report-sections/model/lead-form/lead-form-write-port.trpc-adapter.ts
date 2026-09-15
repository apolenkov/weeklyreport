"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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

// Production adapter at the owned-network seam. Transport details and cache
// invalidation stay here; the editor implementation owns workflow decisions.
export function useLeadFormWritePort(): LeadFormWritePort {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
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

  const saveDraft = useCallback<LeadFormWritePort["saveDraft"]>(
    async (input) => {
      try {
        const saved = await saveDraftMutation.mutateAsync(input);
        invalidateLeadForm(queryClient, trpc);
        return saved;
      } catch (error: unknown) {
        throw normalizeWriteError(error);
      }
    },
    [queryClient, saveDraftMutation, trpc],
  );
  const submit = useCallback<LeadFormWritePort["submit"]>(
    async (input) => {
      try {
        const saved = await submitMutation.mutateAsync(input);
        invalidateLeadForm(queryClient, trpc);
        invalidateDashboard(queryClient, trpc);
        invalidateLeadHistory(queryClient, trpc);
        return saved;
      } catch (error: unknown) {
        throw normalizeWriteError(error);
      }
    },
    [queryClient, submitMutation, trpc],
  );
  const resolvePlan = useCallback<LeadFormWritePort["resolvePlan"]>(
    async (input) => {
      try {
        const result = await resolvePlanMutation.mutateAsync(input);
        invalidateLeadForm(queryClient, trpc);
        return result;
      } catch (error: unknown) {
        throw normalizeWriteError(error);
      }
    },
    [queryClient, resolvePlanMutation, trpc],
  );
  const restorePlan = useCallback<LeadFormWritePort["restorePlan"]>(
    async (input) => {
      try {
        const result = await restorePlanMutation.mutateAsync(input);
        invalidateLeadForm(queryClient, trpc);
        return result;
      } catch (error: unknown) {
        throw normalizeWriteError(error);
      }
    },
    [queryClient, restorePlanMutation, trpc],
  );
  const promotePlan = useCallback<LeadFormWritePort["promotePlan"]>(
    async (input) => {
      try {
        const result = await promotePlanMutation.mutateAsync(input);
        invalidateLeadForm(queryClient, trpc);
        return result;
      } catch (error: unknown) {
        throw normalizeWriteError(error);
      }
    },
    [queryClient, promotePlanMutation, trpc],
  );
  const fillFrom = useCallback<LeadFormWritePort["fillFrom"]>(
    async (input) => {
      try {
        const result = await fillFromMutation.mutateAsync(input);
        invalidateLeadForm(queryClient, trpc);
        return result;
      } catch (error: unknown) {
        throw normalizeWriteError(error);
      }
    },
    [fillFromMutation, queryClient, trpc],
  );
  const revoke = useCallback<LeadFormWritePort["revoke"]>(
    async (input) => {
      try {
        const result = await revokeMutation.mutateAsync(input);
        invalidateLeadForm(queryClient, trpc);
        invalidateDashboard(queryClient, trpc);
        invalidateLeadHistory(queryClient, trpc);
        return result;
      } catch (error: unknown) {
        throw normalizeWriteError(error);
      }
    },
    [queryClient, revokeMutation, trpc],
  );
  const requestReopen = useCallback<LeadFormWritePort["requestReopen"]>(
    async (input) => {
      try {
        const result = await reopenMutation.mutateAsync(input);
        invalidateLeadForm(queryClient, trpc);
        return result;
      } catch (error: unknown) {
        throw normalizeWriteError(error);
      }
    },
    [queryClient, reopenMutation, trpc],
  );

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
