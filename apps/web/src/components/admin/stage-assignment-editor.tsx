'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../lib/trpc-context';

import type { MockUser, StageName } from './mock-data';

const STAGE_COLORS: Record<StageName, string> = {
  Planning: 'var(--color-starbucks-green)',
  Analysis: 'var(--color-starbucks-accent)',
  Design: 'var(--color-starbucks-gold)',
  Development: 'var(--color-primary)',
  Testing: 'var(--color-destructive)',
  DevOps: '#6366f1',
  Support: 'var(--color-muted-foreground)',
};

type StageAssignmentEditorProps = {
  readonly projectId: string;
  readonly projectName: string;
  readonly leads: MockUser[];
};

/**
 * Stage Assignment Editor.
 *
 * Renders the FULL 7-stage SDLC catalogue for a project: each stage shows
 * either the current assignee or "Unassigned" with a dropdown to fill it in.
 * This way head sees the complete coverage picture instead of only the rows
 * that already exist (which hides gaps).
 *
 * Two queries: `listStages` (catalogue) + `listStageAssignments` (per-project
 * rows). We index assignments by stageId and walk the stage catalogue in
 * sortOrder so UI order is deterministic.
 */
export function StageAssignmentEditor({ projectId, projectName, leads }: StageAssignmentEditorProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const stagesQuery = useQuery(trpc.admin.listStages.queryOptions());
  const assignmentsQuery = useQuery(
    trpc.admin.listStageAssignments.queryOptions({ projectId }),
  );

  function invalidateAssignments() {
    void qc.invalidateQueries(trpc.admin.listStageAssignments.pathFilter());
  }

  const saveMut = useMutation(
    trpc.admin.saveStageAssignment.mutationOptions({
      onSuccess: () => {
        invalidateAssignments();
        toast.success('Stage assignment saved');
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to save stage assignment');
      },
    }),
  );

  const deleteMut = useMutation(
    trpc.admin.deleteStageAssignment.mutationOptions({
      onSuccess: () => {
        invalidateAssignments();
        toast.success('Stage assignment removed');
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to remove stage assignment');
      },
    }),
  );

  const stages = stagesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  // Map stageId → assignment for O(1) lookup as we walk the stage catalogue.
  const assignmentByStage = new Map(
    assignments.map((a) => [a.stageId, a]),
  );

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
        const stageColor = STAGE_COLORS[stageName] ?? 'var(--color-muted-foreground)';
        const assignment = assignmentByStage.get(stage.id);
        const currentAssignee = assignment?.userId ?? '';
        const selectId = `${projectId}-${stage.id}`;

        function handleChange(nextUserId: string) {
          if (!nextUserId) {
            // Remove assignment entirely (only meaningful if one exists).
            if (assignment) deleteMut.mutate({ id: assignment.id });
            return;
          }
          if (nextUserId === currentAssignee) return;
          // upsert keyed off (userId, stageId, projectId) — assigning a
          // previously-unassigned stage just creates the row.
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
                  ? 'border-[var(--color-border)] text-[var(--color-foreground)]'
                  : 'border-dashed border-[var(--color-muted-foreground)] text-[var(--color-muted-foreground)]'
              }`}
              aria-label={`Assign ${stageName} stage for ${projectName}`}
            >
              <option value="">— не назначено —</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name.split(' ')[0]}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
