"use client";

import { shortName, shortNameFromName } from "@customreport/shared";
import type { ReactNode } from "react";

import type { AdminUserView, StageName } from "../../model/admin-types";
import {
  useStageAssignmentData,
  useStageAssignmentMutations,
} from "../../model/use-stage-assignments";

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

const STAGE_SELECT_BASE =
  "w-full max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] border bg-[var(--color-card)] px-1.5 py-1.5 text-xs transition-colors focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50";
// A dashed outline marks the coverage gap an unassigned stage represents.
const STAGE_SELECT_CLASS = {
  assigned: `${STAGE_SELECT_BASE} border-[var(--color-border)] text-[var(--color-foreground)]`,
  unassigned: `${STAGE_SELECT_BASE} border-dashed border-[var(--color-muted-foreground)] text-[var(--color-muted-foreground)]`,
} as const;

interface StageCellProps {
  readonly stage: { readonly id: string; readonly name: string };
  readonly assignment:
    | {
        readonly id: string;
        readonly userId: string;
        readonly userName?: string | undefined;
      }
    | undefined;
  readonly projectId: string;
  readonly projectName: string;
  readonly leads: readonly AdminUserView[];
  readonly disabled: boolean;
  readonly onAssign: (stageId: string, userId: string) => void;
  readonly onClear: (assignmentId: string) => void;
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
}: StageCellProps) {
  const stageName = stage.name as StageName;
  const currentAssignee = assignment?.userId ?? "";
  // A stored assignee outside the eligible lead list (regrouped,
  // deactivated) still holds the slot: surface it as a disabled option so
  // the select keeps the value instead of rendering as unassigned.
  const isRetainedAssignee =
    assignment !== undefined &&
    !leads.some((lead) => lead.id === currentAssignee);
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
        className="flex items-center justify-center gap-1 text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground)]"
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: stageColorOf(stageName) }}
        />
        {stageName}
      </label>
      <select
        id={selectId}
        name={selectId}
        autoComplete="off"
        data-interaction-effect="mutation-required"
        value={currentAssignee}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className={
          STAGE_SELECT_CLASS[currentAssignee ? "assigned" : "unassigned"]
        }
        aria-label={`Assign ${stageName} stage for ${projectName}`}
      >
        <option value="">Unassigned</option>
        {isRetainedAssignee ? (
          <option value={currentAssignee} disabled>
            {shortNameFromName(assignment.userName ?? "") || currentAssignee}
          </option>
        ) : null}
        {leads.map((lead) => (
          <option key={lead.id} value={lead.id}>
            {shortName(lead)}
          </option>
        ))}
      </select>
    </div>
  );
}

const NOTICE_TONE_CLASS = {
  muted: "text-[var(--color-muted-foreground)]",
  error: "text-[var(--color-destructive)]",
} as const;

function StageEditorNotice({
  tone,
  children,
  loadingLabel,
}: {
  readonly tone: keyof typeof NOTICE_TONE_CLASS;
  readonly children: ReactNode;
  readonly loadingLabel?: string;
}) {
  return (
    <p
      className={`mt-3 text-xs ${NOTICE_TONE_CLASS[tone]}`}
      role={loadingLabel ? "status" : undefined}
      aria-busy={loadingLabel ? "true" : undefined}
      aria-label={loadingLabel}
    >
      {children}
    </p>
  );
}

interface StageAssignmentEditorProps {
  readonly projectId: string;
  readonly projectName: string;
  readonly leads: readonly AdminUserView[];
}

export function StageAssignmentEditor({
  projectId,
  projectName,
  leads,
}: StageAssignmentEditorProps) {
  const { stages, assignments, filteredLeads, isLoading, isError } =
    useStageAssignmentData(projectId, leads);
  const { saveMut, deleteMut } = useStageAssignmentMutations();

  if (isLoading) {
    return (
      <StageEditorNotice
        tone="muted"
        loadingLabel={`Loading stage assignments for ${projectName}`}
      >
        Loading stages for {projectName}…
      </StageEditorNotice>
    );
  }

  if (isError) {
    return (
      <StageEditorNotice tone="error">
        Failed to load stage data.
      </StageEditorNotice>
    );
  }

  if (stages.length === 0) {
    return (
      <StageEditorNotice tone="muted">
        No stages defined yet. Seed the SDLC stages catalogue first.
      </StageEditorNotice>
    );
  }

  const assignmentByStage = new Map(assignments.map((a) => [a.stageId, a]));

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
