"use client";

import type { ProjectActivity } from "@customreport/shared";

import { pluralize } from "../../../shared/lib/format/pluralize";
import type { AdminUserView } from "../model/admin-types";
import { ActivityLeadsEditor } from "./activity-leads-editor";

interface ActiveActivityRowProps {
  readonly activity: ProjectActivity;
  readonly groupName: string;
  readonly users: readonly AdminUserView[];
  readonly isExpanded: boolean;
  readonly onToggleExpand: (id: string) => void;
  readonly onEdit: (activity: ProjectActivity) => void;
  readonly onArchive: (activity: ProjectActivity) => void;
  readonly isArchiving: boolean;
}

function ActivitySummary({
  activity,
  groupName,
  isExpanded,
  onToggleExpand,
}: {
  readonly activity: ProjectActivity;
  readonly groupName: string;
  readonly isExpanded: boolean;
  readonly onToggleExpand: (id: string) => void;
}) {
  const linkedNames = activity.linkedProducts
    .map((link) => link.productName)
    .join(", ");

  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={() => onToggleExpand(activity.id)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
        aria-label={`${isExpanded ? "Collapse" : "Expand"} lead attachments for ${activity.name}`}
        aria-expanded={isExpanded}
      >
        <ChevronIcon expanded={isExpanded} />
      </button>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="min-w-0">
          <span className="break-words text-sm font-semibold text-[var(--color-foreground)]">
            {activity.name}
          </span>
          <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
            Group: {groupName}
          </span>
        </div>
        <span className="break-words text-xs text-[var(--color-muted-foreground)]">
          {linkedNames
            ? `Linked products: ${linkedNames}`
            : "No linked products"}
          {activity.jiraAccounts.length > 0
            ? ` · Jira: ${activity.jiraAccounts.join(", ")}`
            : ""}
        </span>
      </div>
    </div>
  );
}

function ActivityRowActions({
  activity,
  onEdit,
  onArchive,
  isArchiving,
}: {
  readonly activity: ProjectActivity;
  readonly onEdit: (activity: ProjectActivity) => void;
  readonly onArchive: (activity: ProjectActivity) => void;
  readonly isArchiving: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
      <span className="text-xs text-[var(--color-muted-foreground)]">
        {activity.leadIds.length}{" "}
        {pluralize(activity.leadIds.length, "lead", "leads")}
      </span>
      <button
        type="button"
        onClick={() => onEdit(activity)}
        className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[var(--color-border-accent-hover)] hover:bg-[var(--color-success)]"
        aria-label={`Edit ${activity.name}`}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => onArchive(activity)}
        disabled={isArchiving}
        className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-3 text-xs font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Archive ${activity.name}`}
      >
        Archive
      </button>
    </div>
  );
}

export function ActiveActivityRow({
  activity,
  groupName,
  users,
  isExpanded,
  onToggleExpand,
  onEdit,
  onArchive,
  isArchiving,
}: ActiveActivityRowProps) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] transition-shadow hover:shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <ActivitySummary
          activity={activity}
          groupName={groupName}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
        />
        <ActivityRowActions
          activity={activity}
          onEdit={onEdit}
          onArchive={onArchive}
          isArchiving={isArchiving}
        />
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-3">
            {isExpanded && (
              <ActivityLeadsEditor activity={activity} users={users} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 transition-transform duration-200"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
