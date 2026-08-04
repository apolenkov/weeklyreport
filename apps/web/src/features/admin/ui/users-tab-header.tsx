"use client";

import { PlusIcon } from "../../../shared/ui/icons";
import { TabFilter, TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import {
  USER_ROLE_FILTER_OPTIONS,
  USER_STATUS_FILTER_OPTIONS,
  type UserRoleFilter,
  type UserStatusFilter,
} from "../model/user-table-filters";
import type { UsersFilterState } from "./use-users-tab-state";

interface FilterOption {
  readonly value: string;
  readonly label: string;
}

function UsersFilterBar({
  filters,
  groupFilterOptions,
}: {
  readonly filters: UsersFilterState;
  readonly groupFilterOptions: readonly FilterOption[];
}) {
  return (
    <>
      <TabFilter
        value={filters.statusFilter}
        onChange={(v) => filters.setStatusFilter(v as UserStatusFilter)}
        options={USER_STATUS_FILTER_OPTIONS}
        testId="users-status-filter"
        ariaLabel="Filter by status"
      />
      <TabFilter
        value={filters.roleFilter}
        onChange={(v) => filters.setRoleFilter(v as UserRoleFilter)}
        options={USER_ROLE_FILTER_OPTIONS}
        testId="users-role-filter"
        ariaLabel="Filter by role"
      />
      <TabFilter
        value={filters.groupFilter ?? "all"}
        onChange={(v) => filters.setGroupFilter(v === "all" ? null : v)}
        options={groupFilterOptions}
        testId="users-group-filter"
        ariaLabel="Filter by group"
      />
      <TabSearch
        value={filters.search}
        onChange={filters.setSearch}
        placeholder="Search users…"
        testId="users-search"
        ariaLabel="Search users"
      />
    </>
  );
}

function AddUserButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)]"
      aria-label="Add new user"
    >
      <PlusIcon />
      Add User
    </button>
  );
}

export function UsersTabHeader({
  userCount,
  filters,
  groupFilterOptions,
  onAdd,
}: {
  readonly userCount: number;
  readonly filters: UsersFilterState;
  readonly groupFilterOptions: readonly FilterOption[];
  readonly onAdd: () => void;
}) {
  return (
    <TabHeader
      title="Users"
      description="Manage group members and their roles."
      count={`${userCount} users`}
      search={
        <UsersFilterBar
          filters={filters}
          groupFilterOptions={groupFilterOptions}
        />
      }
      actions={<AddUserButton onClick={onAdd} />}
    />
  );
}
