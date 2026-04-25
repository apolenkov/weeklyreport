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
 * Loads `admin.listStageAssignments` for the given project and lets a head
 * reassign each stage to a lead or remove the assignment.
 *
 * Backend gap (deferred): there is currently no `admin.listStages` endpoint
 * exposing the stage catalogue (id + name). Without it, the UI can only
 * REASSIGN stages that are already present on the project, not create new
 * stage rows from scratch. Reassignment is implemented by deleting the prior
 * assignment, then saving a new one with the same stageId. Creating fresh
 * stages will require a stages-list endpoint and is tracked for a future plan.
 */
export function StageAssignmentEditor({ projectId, projectName, leads }: StageAssignmentEditorProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const assignmentsQuery = useQuery(
    trpc.admin.listStageAssignments.queryOptions({ projectId }),
  );

  function invalidateAssignments() {
    qc.invalidateQueries(trpc.admin.listStageAssignments.pathFilter());
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

  const assignments = assignmentsQuery.data ?? [];

  if (assignmentsQuery.isLoading) {
    return (
      <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
        Loading stage assignments for {projectName}…
      </p>
    );
  }

  if (assignmentsQuery.isError) {
    return (
      <p className="mt-3 text-xs text-[var(--color-destructive)]">
        Failed to load stage assignments.
      </p>
    );
  }

  if (assignments.length === 0) {
    return (
      <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
        No stage assignments yet for this project. Stage seeding is required before assignments can be edited.
      </p>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-7 gap-2">
      {assignments.map((assignment) => {
        const stageName = assignment.stageName as StageName;
        const stageColor = STAGE_COLORS[stageName] ?? 'var(--color-muted-foreground)';
        const currentAssignee = assignment.userId;

        function handleChange(nextUserId: string) {
          if (!nextUserId) {
            // Remove assignment entirely.
            deleteMut.mutate({ id: assignment.id });
            return;
          }
          if (nextUserId === currentAssignee) return;
          // Replace assignee: delete the old row, then save a new one for the
          // same stageId. The repository upsert keys off (projectId, stageId).
          saveMut.mutate({
            userId: nextUserId,
            stageId: assignment.stageId,
            projectId,
          });
        }

        return (
          <div key={assignment.id} className="space-y-1">
            <label
              htmlFor={`${projectId}-${assignment.stageId}`}
              className="block text-center text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: stageColor }}
            >
              {stageName}
            </label>
            <select
              id={`${projectId}-${assignment.stageId}`}
              value={currentAssignee}
              onChange={(e) => handleChange(e.target.value)}
              disabled={saveMut.isPending || deleteMut.isPending}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-1.5 py-1.5 text-xs text-[var(--color-foreground)] transition-colors focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Assign ${stageName} stage for ${projectName}`}
            >
              <option value="">Unassigned</option>
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
