import { PlusIcon } from "../../../../shared/ui/icons/action-icons";
import {
  TabFilter,
  TabHeader,
  TabSearch,
} from "../../../../shared/ui/tabs/tab-header";

const ARCHIVE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;

export type ArchiveFilterValue = (typeof ARCHIVE_OPTIONS)[number]["value"];

interface GroupsTabHeaderProps {
  readonly activeCount: number;
  readonly totalCount: number;
  readonly archiveFilter: ArchiveFilterValue;
  readonly onArchiveFilterChange: (value: ArchiveFilterValue) => void;
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly onAdd: () => void;
}

// Admin UI uses "Group/Groups" wording; the Prisma model and test ids keep
// their canonical ReportingGroup terminology.
export function GroupsTabHeader({
  activeCount,
  totalCount,
  archiveFilter,
  onArchiveFilterChange,
  search,
  onSearchChange,
  onAdd,
}: GroupsTabHeaderProps) {
  return (
    <TabHeader
      title="Groups"
      description={`Reporting groups (organisational units). ${activeCount} active.`}
      count={`${totalCount} groups`}
      search={
        <>
          <TabFilter
            value={archiveFilter}
            onChange={(value) =>
              onArchiveFilterChange(value as ArchiveFilterValue)
            }
            options={ARCHIVE_OPTIONS}
            testId="groups-archive-filter"
            ariaLabel="Filter by archive status"
          />
          <TabSearch
            value={search}
            onChange={onSearchChange}
            placeholder="Search groups…"
            testId="groups-search"
            ariaLabel="Search groups"
          />
        </>
      }
      actions={
        <button
          type="button"
          onClick={onAdd}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)]"
          aria-label="Add new group"
        >
          <PlusIcon />
          Add group
        </button>
      }
    />
  );
}
