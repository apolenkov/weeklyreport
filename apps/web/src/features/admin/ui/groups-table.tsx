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
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Name
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Description
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Leader
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Status
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr
              key={group.id}
              className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]"
            >
              <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
                {group.name}
              </td>
              <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                {group.description || "—"}
              </td>
              <td className="px-4 py-3 text-[var(--color-foreground)]">
                {group.headUserId
                  ? (headById.get(group.headUserId)?.name ?? "—")
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    group.archived
                      ? "inline-flex rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-muted-foreground)]"
                      : "inline-flex rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary)]"
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
                  {!group.archived && activeGroupCount > 1 && (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
