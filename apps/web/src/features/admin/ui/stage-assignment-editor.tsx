"use client";

import { shortName } from "@customreport/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import type { MockUser, StageName } from "../model/admin-types";

const STAGE_COLORS: Record<StageName, string> = {
  Planning: "var(--color-starbucks-green)",
  Analysis: "var(--color-starbucks-accent)",
  Design: "var(--color-starbucks-gold)",
  Development: "var(--color-primary)",
  Testing: "var(--color-destructive)",
  DevOps: "var(--color-stage-devops)",
  Support: "var(--color-muted-foreground)",
};

interface StageAssignmentEditorProps {
  readonly projectId: string;
  readonly projectName: string;
  readonly leads: readonly MockUser[];
}

// Full catalogue (not only existing rows) so head sees coverage gaps;
// lead dropdown is scoped to the product's owning group.
export function StageAssignmentEditor({
  projectId,
  projectName,
  leads,
}: StageAssignmentEditorProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

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
    if (groups.length === 0) {
      // Product not yet assigned to a group; show all leads (graceful degradation).
      return leads;
    }
    const groupIds = new Set(groups.map((g) => g.id));
    return leads.filter((lead) => groupIds.has(lead.groupId));
  }, [leads, productGroupsQuery.data]);

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

  const stages = stagesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  const assignmentByStage = new Map(assignments.map((a) => [a.stageId, a]));

  if (stagesQuery.isLoading || assignmentsQuery.isLoading) {
    return (
      <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
        Loading stages for {projectName}…
      </p>
    );
  }

  if (stagesQuery.isError || assignmentsQuery.isError) {
    return (
      <p className="mt-3 text-xs text-[var(--color-destructive)]">
        Failed to load stage data.
      </p>
    );
  }

  if (stages.length === 0) {
    return (
      <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
        No stages defined yet. Seed the SDLC stages catalogue first.
      </p>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {stages.map((stage) => {
        const stageName = stage.name as StageName;
        // stage.name is DB data cast to StageName; an unknown stage yields no
        // STAGE_COLORS entry at runtime. Partial keeps the lookup honestly
        // `string | undefined` so the fallback stays a real guard.
        const stageColor =
          (STAGE_COLORS as Partial<Record<StageName, string>>)[stageName] ??
          "var(--color-muted-foreground)";
        const assignment = assignmentByStage.get(stage.id);
        const currentAssignee = assignment?.userId ?? "";
        const selectId = `${projectId}-${stage.id}`;

        function handleChange(nextUserId: string) {
          if (!nextUserId) {
            if (assignment) deleteMut.mutate({ id: assignment.id });
            return;
          }
          if (nextUserId === currentAssignee) return;
          // The API treats (projectId, stageId) as one editable slot: selecting
          // a different lead replaces the assignee instead of adding a second
          // assignment row for the same stage.
          saveMut.mutate({
            userId: nextUserId,
            stageId: stage.id,
            projectId,
          });
        }

        return (
          <div key={stage.id} className="space-y-1">
            <label
              htmlFor={selectId}
              className="block text-center text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: stageColor }}
            >
              {stageName}
            </label>
            <select
              id={selectId}
              value={currentAssignee}
              onChange={(e) => handleChange(e.target.value)}
              disabled={saveMut.isPending || deleteMut.isPending}
              className={`w-full rounded-[var(--radius-sm)] border bg-white px-1.5 py-1.5 text-xs transition-colors focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50 ${
                currentAssignee
                  ? "border-[var(--color-border)] text-[var(--color-foreground)]"
                  : "border-dashed border-[var(--color-muted-foreground)] text-[var(--color-muted-foreground)]"
              }`}
              aria-label={`Assign ${stageName} stage for ${projectName}`}
            >
              <option value="">-- unassigned --</option>
              {filteredLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {shortName(lead)}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
