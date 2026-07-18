"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";
import type { buildLeadSubmitPayload } from "../../report-sections";

type LeadSubmitInput = ReturnType<typeof buildLeadSubmitPayload>;

/**
 * The draft module's write dependency: the submit mutation plus the cache
 * invalidation it triggers on success. Extracted so the module owns the submit
 * flow (build payload, advance version, lock) while the transport stays
 * injectable — production wires it from tRPC, tests pass a fake.
 */
export interface LeadFormDraftSeam {
  readonly submitSection: (
    input: LeadSubmitInput,
  ) => Promise<ReportSectionReadModel>;
  readonly submitPending: boolean;
  readonly onSubmitSuccess: () => void;
}

/** Production seam: the real `reports.submit` mutation and lead-cache invalidation. */
export function useLeadFormDraftSeam(): LeadFormDraftSeam {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const submitMut = useMutation(trpc.reports.submit.mutationOptions({}));
  return {
    submitSection: submitMut.mutateAsync,
    submitPending: submitMut.isPending,
    onSubmitSuccess: () => {
      invalidateLeadForm(qc, trpc);
      // A submit changes the head dashboard's submission roll-up too.
      invalidateDashboard(qc, trpc);
      invalidateLeadHistory(qc, trpc);
    },
  };
}
