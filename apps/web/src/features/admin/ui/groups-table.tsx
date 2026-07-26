"use client";

import type { MockGroup, MockUser } from "../model/admin-types";

interface GroupsTableProps {
  readonly groups: readonly MockGroup[];
  readonly headById: ReadonlyMap<string, MockUser>;
  readonly activeGroupCount: number;
  readonly onEdit: (group: MockGroup) => void;
  readonly onArchive: (group: MockGroup) => void;
}

// Compact table-row actions (denser than --touch-target-min header controls).
const ROW_ACTION_CLASS =
  "btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold transition-colors";
const ROW_ACTION_EDIT_CLASS = `${ROW_ACTION_CLASS} text-[var(--color-starbucks-accent)] hover:border-[rgba(0,117,74,0.3)] hover:bg-[var(--color-success)]`;
const ROW_ACTION_ARCHIVE_CLASS = `${ROW_ACTION_CLASS} text-[var(--color-destructive)] hover:border-[rgba(200,32,20,0.3)] hover:bg-red-50`;

const STATUS_PILL_CLASS =
  "inline-flex rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold";
const STATUS_ARCHIVED_CLASS = `${STATUS_PILL_CLASS} bg-[var(--color-muted)] text-[var(--color-muted-foreground)]`;
const STATUS_ACTIVE_CLASS = `${STATUS_PILL_CLASS} bg-[var(--color-success)] text-[var(--color-primary)]`;

export function GroupsTable({
  groups,
  headById,
  activeGroupCount,
  onEdit,
  onArchive,
}: GroupsTableProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
      <table className="w-full text-left text-sm" data-testid="groups-table">
        <GroupsTableHead />
        <tbody>
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              headName={
                group.headUserId
                  ? (headById.get(group.headUserId)?.name ?? "—")
                  : "—"
              }
              // The last active group must stay unarchivable, so the action is
              // withheld rather than rendered disabled.
              canArchive={!group.archived && activeGroupCount > 1}
              onEdit={onEdit}
              onArchive={onArchive}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HEAD_CELL_CLASS =
  "px-4 py-3 font-semibold text-[var(--color-foreground)]";

function GroupsTableHead() {
  return (
    <thead>
      <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
        <th className={HEAD_CELL_CLASS}>Name</th>
        <th className={HEAD_CELL_CLASS}>Description</th>
        <th className={HEAD_CELL_CLASS}>Leader</th>
        <th className={HEAD_CELL_CLASS}>Status</th>
        <th className={`${HEAD_CELL_CLASS} text-right`}>Actions</th>
      </tr>
    </thead>
  );
}

interface GroupRowProps {
  readonly group: MockGroup;
  readonly headName: string;
  readonly canArchive: boolean;
  readonly onEdit: (group: MockGroup) => void;
  readonly onArchive: (group: MockGroup) => void;
}

function GroupRow({
  group,
  headName,
  canArchive,
  onEdit,
  onArchive,
}: GroupRowProps) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]">
      <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
        {group.name}
      </td>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
        {group.description || "—"}
      </td>
      <td className="px-4 py-3 text-[var(--color-foreground)]">{headName}</td>
      <td className="px-4 py-3">
        <span
          className={
            group.archived ? STATUS_ARCHIVED_CLASS : STATUS_ACTIVE_CLASS
          }
        >
          {group.archived ? "Archived" : "Active"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(group)}
            className={ROW_ACTION_EDIT_CLASS}
            aria-label={`Edit ${group.name}`}
          >
            Edit
          </button>
          {canArchive && (
            <button
              type="button"
              onClick={() => onArchive(group)}
              className={ROW_ACTION_ARCHIVE_CLASS}
              aria-label={`Archive ${group.name}`}
            >
              Archive
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
