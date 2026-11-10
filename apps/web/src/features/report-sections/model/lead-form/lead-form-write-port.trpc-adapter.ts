"use client";

import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import type { ItemOutcomeResult } from "@weeklyreport/shared";
import { useCallback, useMemo, useState } from "react";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
  invalidateLeadPlanOutcome,
} from "../../../../shared/lib/query/cache-keys";
import { isConflictError } from "../../../../shared/lib/trpc/trpc";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import { formSectionOf } from "../form-section";
import {
  type LeadFormDraftSaveInput,
  type LeadFormOutcomeResult,
  LeadFormWriteError,
  type LeadFormWritePort,
} from "./lead-form-write-port";
import { useStoredDraftLedger } from "./stored-draft-ledger";

function normalizeWriteError(error: unknown): LeadFormWriteError {
  if (error instanceof LeadFormWriteError) return error;
  const message =
    error instanceof Error && error.message ? error.message : "Write failed";
  return new LeadFormWriteError(
    isConflictError(error) ? "conflict" : "error",
    message,
  );
}

const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;

// A whole-section draft write may have been committed even when the caller
// sees a failure, so only a definite 4xx rejection is settled; a transport
// failure or server error is ambiguous and may be retried verbatim.
function normalizeDraftWriteError(error: unknown): LeadFormWriteError {
  const normalized = normalizeWriteError(error);
  if (normalized.kind === "conflict") return normalized;
  const status =
    error instanceof TRPCClientError
      ? (error.data as { httpStatus?: number } | undefined)?.httpStatus
      : undefined;
  const definite =
    status !== undefined &&
    status >= HTTP_CLIENT_ERROR_MIN &&
    status < HTTP_SERVER_ERROR_MIN;
  return new LeadFormWriteError(
    definite ? "restriction" : "ambiguous",
    normalized.message,
  );
}

// Every section a write returns goes back to the form in the form's shape and
// into the ledger, which tells the next save what the server still holds.
function useFormSectionWrites() {
  const trpc = useTRPC();
  const ledger = useStoredDraftLedger();
  const { mutateAsync: saveDraft } = useMutation(
    trpc.reports.saveDraft.mutationOptions({}),
  );
  const { mutateAsync: resolvePlan } = useMutation(
    trpc.leadForm.resolvePlan.mutationOptions({}),
  );
  const { mutateAsync: restorePlan } = useMutation(
    trpc.leadForm.restorePlan.mutationOptions({}),
  );
  const { mutateAsync: promotePlan } = useMutation(
    trpc.leadForm.promotePlan.mutationOptions({}),
  );
  return useMemo(() => {
    const outcome =
      <Input>(run: (input: Input) => Promise<ItemOutcomeResult>) =>
      async (input: Input): Promise<LeadFormOutcomeResult> => {
        const result = await run(input);
        ledger.record(result.section);
        return { ...result, section: formSectionOf(result.section) };
      };
    return {
      saveDraft: {
        mutateAsync: async (input: LeadFormDraftSaveInput) => {
          const deleted = ledger.deletionsFor(input);
          const saved = await saveDraft({
            ...input,
            ...(deleted.length > 0
              ? { deletedIncompleteRecords: deleted }
              : {}),
          });
          ledger.record(saved);
          return formSectionOf(saved);
        },
      },
      resolvePlan: { mutateAsync: outcome(resolvePlan) },
      restorePlan: { mutateAsync: outcome(restorePlan) },
      promotePlan: { mutateAsync: outcome(promotePlan) },
    };
  }, [ledger, promotePlan, resolvePlan, restorePlan, saveDraft]);
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
  normalize: (error: unknown) => LeadFormWriteError = normalizeWriteError,
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
        throw normalize(error);
      } finally {
        setRequests((current) =>
          current.filter((request) => request.token !== attempt.token),
        );
      }
    },
    [invalidate, mutation, normalize, queryClient, sectionOf, trpc],
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
  const sectionWrites = useFormSectionWrites();
  const fillFromMutation = useMutation(
    trpc.leadForm.fillFrom.mutationOptions({}),
  );
  const revokeMutation = useMutation(trpc.leadForm.revoke.mutationOptions({}));
  const reopenMutation = useMutation(
    trpc.leadForm.requestReopen.mutationOptions({}),
  );

  const saveDraft = useWrite(
    sectionWrites.saveDraft,
    invalidateForm,
    reportSectionOf,
    normalizeDraftWriteError,
  );
  const submit = useWrite(
    submitMutation,
    invalidateFormDashboardHistory,
    reportSectionOf,
  );
  const resolvePlan = useWrite(
    sectionWrites.resolvePlan,
    invalidateLeadPlanOutcome,
    reportSectionOf,
  );
  const restorePlan = useWrite(
    sectionWrites.restorePlan,
    invalidateLeadPlanOutcome,
    reportSectionOf,
  );
  const promotePlan = useWrite(
    sectionWrites.promotePlan,
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
