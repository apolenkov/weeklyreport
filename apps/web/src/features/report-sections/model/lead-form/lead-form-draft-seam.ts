"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import type { buildLeadSubmitPayload } from "../lead-submit-readiness";

type LeadSubmitInput = ReturnType<typeof buildLeadSubmitPayload>;

// Injectable write seam: production wires tRPC; tests pass a fake.
export interface LeadFormDraftSeam {
  readonly submitSection: (
    input: LeadSubmitInput,
  ) => Promise<ReportSectionReadModel>;
  readonly submitPending: boolean;
  readonly onSubmitSuccess: () => void;
}

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
