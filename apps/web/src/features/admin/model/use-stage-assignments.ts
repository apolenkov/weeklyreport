"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import type { AdminUserView } from "./admin-types";

// Both writes move the same (projectId, stageId) slot, so both refresh the
// assignment list and the per-product coverage counts.
export function useStageAssignmentMutations() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  function invalidateAssignments() {
    void qc.invalidateQueries(trpc.admin.listStageAssignments.pathFilter());
    void qc.invalidateQueries(
      trpc.admin.listStageAssignmentCounts.pathFilter(),
    );
  }

  const saveMut = useMutation(
    trpc.admin.saveStageAssignment.mutationOptions({
      onSuccess: () => {
        invalidateAssignments();
        toast.success("Stage assignment saved");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const deleteMut = useMutation(
    trpc.admin.deleteStageAssignment.mutationOptions({
      onSuccess: () => {
        invalidateAssignments();
        toast.success("Stage assignment removed");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  return { saveMut, deleteMut };
}

// The full stage catalogue (not only existing rows) so head sees coverage gaps;
// the lead dropdown is scoped to the product's owning group.
export function useStageAssignmentData(
  projectId: string,
  leads: readonly AdminUserView[],
) {
  const trpc = useTRPC();

  const stagesQuery = useQuery(trpc.admin.listStages.queryOptions());
  const assignmentsQuery = useQuery(
    trpc.admin.listStageAssignments.queryOptions({ projectId }),
  );
  // @@unique([groupId]) on GroupProduct: each product has one owning group.
  const productGroupsQuery = useQuery(
    trpc.admin.listProductGroups.queryOptions({ productId: projectId }),
  );

  const filteredLeads = useMemo(() => {
    const groups = productGroupsQuery.data ?? [];
    // Product not yet assigned to a group; show all leads (graceful degradation).
    if (groups.length === 0) return leads;
    const groupIds = new Set(groups.map((g) => g.id));
    return leads.filter((lead) => groupIds.has(lead.groupId));
  }, [leads, productGroupsQuery.data]);

  return {
    stages: stagesQuery.data ?? [],
    assignments: assignmentsQuery.data ?? [],
    filteredLeads,
    isLoading: stagesQuery.isLoading || assignmentsQuery.isLoading,
    isError: stagesQuery.isError || assignmentsQuery.isError,
  };
}
