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

// stage.name is DB data cast to StageName; an unknown stage yields no
// STAGE_COLORS entry at runtime. Partial keeps the lookup honestly
// `string | undefined` so the fallback stays a real guard.
function stageColorOf(stageName: StageName): string {
  return (
    (STAGE_COLORS as Partial<Record<StageName, string>>)[stageName] ??
    "var(--color-muted-foreground)"
  );
}

// One editable slot: the API treats (projectId, stageId) as a single
// assignment, so picking a different lead replaces the assignee instead of
// adding a second row, and clearing the select deletes the row.
function StageCell({
  stage,
  assignment,
  projectId,
  projectName,
  leads,
  disabled,
  onAssign,
  onClear,
}: {
  readonly stage: { readonly id: string; readonly name: string };
  readonly assignment:
    { readonly id: string; readonly userId: string } | undefined;
  readonly projectId: string;
  readonly projectName: string;
  readonly leads: readonly MockUser[];
  readonly disabled: boolean;
  readonly onAssign: (stageId: string, userId: string) => void;
  readonly onClear: (assignmentId: string) => void;
}) {
  const stageName = stage.name as StageName;
  const currentAssignee = assignment?.userId ?? "";
  const selectId = `${projectId}-${stage.id}`;

  function handleChange(nextUserId: string) {
    if (!nextUserId) {
      if (assignment) onClear(assignment.id);
      return;
    }
    if (nextUserId === currentAssignee) return;
    onAssign(stage.id, nextUserId);
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor={selectId}
        className="block text-center text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: stageColorOf(stageName) }}
      >
        {stageName}
      </label>
      <select
        id={selectId}
        value={currentAssignee}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-[var(--radius-sm)] border bg-white px-1.5 py-1.5 text-xs transition-colors focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50 ${
          currentAssignee
            ? "border-[var(--color-border)] text-[var(--color-foreground)]"
            : "border-dashed border-[var(--color-muted-foreground)] text-[var(--color-muted-foreground)]"
        }`}
        aria-label={`Assign ${stageName} stage for ${projectName}`}
      >
        <option value="">-- unassigned --</option>
        {leads.map((lead) => (
          <option key={lead.id} value={lead.id}>
            {shortName(lead)}
          </option>
        ))}
      </select>
    </div>
  );
}

// Both writes move the same (projectId, stageId) slot, so both refresh the
// assignment list and the per-product coverage counts.
function useStageAssignmentMutations() {
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

interface StageAssignmentEditorProps {
  readonly projectId: string;
  readonly projectName: string;
  readonly leads: readonly MockUser[];
}

// Full catalogue (not only existing rows) so head sees coverage gaps;
// lead dropdown is scoped to the product's owning group.
/**
 * Stage Assignment Editor.
 * @param props - The props argument.
 */
export function StageAssignmentEditor({
  projectId,
  projectName,
  leads,
}: StageAssignmentEditorProps) {
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
    if (groups.length === 0) {
      // Product not yet assigned to a group; show all leads (graceful degradation).
      return leads;
    }
    const groupIds = new Set(groups.map((g) => g.id));
    return leads.filter((lead) => groupIds.has(lead.groupId));
  }, [leads, productGroupsQuery.data]);

  const { saveMut, deleteMut } = useStageAssignmentMutations();

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
      {stages.map((stage) => (
        <StageCell
          key={stage.id}
          stage={stage}
          assignment={assignmentByStage.get(stage.id)}
          projectId={projectId}
          projectName={projectName}
          leads={filteredLeads}
          disabled={saveMut.isPending || deleteMut.isPending}
          onAssign={(stageId, userId) =>
            saveMut.mutate({ userId, stageId, projectId })
          }
          onClear={(assignmentId) => deleteMut.mutate({ id: assignmentId })}
        />
      ))}
    </div>
  );
}
