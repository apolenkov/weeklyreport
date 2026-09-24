"use client";

import type { ProjectActivity } from "@customreport/shared";

import type { AdminUserView } from "../model/admin-types";
import { ActiveActivityRow } from "./active-activity-row";

interface ActivitiesTableProps {
  readonly activeActivities: readonly ProjectActivity[];
  readonly hasData: boolean;
  readonly archivedActivities: readonly ProjectActivity[];
  readonly groupNameById: ReadonlyMap<string, string>;
  readonly users: readonly AdminUserView[];
  readonly expandedId: string | null;
  readonly onToggleExpand: (id: string) => void;
  readonly onEdit: (activity: ProjectActivity) => void;
  readonly onArchive: (activity: ProjectActivity) => void;
  readonly onRestore: (activity: ProjectActivity) => void;
  readonly isArchiving: boolean;
}

export function ActivitiesTable({
  activeActivities,
  hasData,
  archivedActivities,
  groupNameById,
  users,
  expandedId,
  onToggleExpand,
  onEdit,
  onArchive,
  onRestore,
  isArchiving,
}: ActivitiesTableProps) {
  return (
    <>
      <div className="space-y-3" data-testid="activities-table">
        {activeActivities.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {hasData
              ? "No activities match the search."
              : "No active activities yet."}
          </p>
        ) : (
          activeActivities.map((activity) => (
            <ActiveActivityRow
              key={activity.id}
              activity={activity}
              groupName={groupNameById.get(activity.groupId) ?? "Unknown group"}
              users={users}
              isExpanded={expandedId === activity.id}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onArchive={onArchive}
              isArchiving={isArchiving}
            />
          ))
        )}
      </div>

      <ArchivedActivityList
        archivedActivities={archivedActivities}
        onRestore={onRestore}
        isArchiving={isArchiving}
      />
    </>
  );
}

function ArchivedActivityList({
  archivedActivities,
  onRestore,
  isArchiving,
}: {
  readonly archivedActivities: readonly ProjectActivity[];
  readonly onRestore: (activity: ProjectActivity) => void;
  readonly isArchiving: boolean;
}) {
  if (archivedActivities.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
        Archived ({archivedActivities.length})
      </h3>
      {archivedActivities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-center justify-between rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3"
        >
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {activity.name}
          </span>
          <button
            type="button"
            onClick={() => onRestore(activity)}
            disabled={isArchiving}
            className="btn-press inline-flex min-h-[34px] max-md:min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[var(--color-border-accent-hover)] hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Restore ${activity.name}`}
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}
