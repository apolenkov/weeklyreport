"use client";

import { useMemo, useRef, useState } from "react";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import { PlusIcon } from "../../../shared/ui/icons";
import { TabFilter, TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import { toAdminUserInput } from "../model/admin";
import type { MockGroup, MockUser } from "../model/admin-types";
import { emptyForm, formFromUser, type UserFormData } from "../model/user-form";
import {
  filterAdminUsers,
  USER_ROLE_FILTER_OPTIONS,
  USER_STATUS_FILTER_OPTIONS,
  userGroupFilterOptions,
  type UserStatusFilter,
} from "../model/user-table-filters";
import { useUserMutations } from "../model/users-tab-mutations";
import { UserEditDialog } from "./user-edit-dialog";
import { UsersTable } from "./users-table";

interface UsersTabProps {
  readonly users: MockUser[];
  readonly groups: MockGroup[];
}

export function UsersTab({ users, groups }: UsersTabProps) {
  const [editingUser, setEditingUser] = useState<MockUser | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MockUser | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState<UserFormData>(() => emptyForm(groups));
  const { activeGroups, groupOptions } = useUserFormGroups(
    groups,
    form.groupId,
  );
  const filters = useUsersFilterState(users);
  const { saveUserMut, deleteUserMut, deactivateUserMut, activateUserMut } =
    useUserMutations(() => setShowDialog(false));

  function openAdd() {
    setEditingUser(null);
    setForm(emptyForm(groups));
    setShowDialog(true);
  }

  function openEdit(user: MockUser) {
    setEditingUser(user);
    setForm(formFromUser(user));
    setShowDialog(true);
  }

  function handleSave() {
    if (!confirmGroupChange(editingUser, form)) return;
    saveUserMut.mutate(toAdminUserInput(form, editingUser?.id));
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteUserMut.mutate({ userId: deleteTarget.id });
    setDeleteTarget(null);
  }

  function openDelete(user: MockUser, trigger: HTMLButtonElement) {
    deleteTriggerRef.current = trigger;
    setDeleteTarget(user);
  }

  const isSaving = saveUserMut.isPending;
  const canSave =
    form.lastName.trim().length > 0 &&
    form.firstName.trim().length > 0 &&
    (form.role === "viewer" || form.groupId.length > 0) &&
    !isSaving;

  return (
    <>
      <div className="space-y-4">
        <TabHeader
          title="Users"
          description="Manage group members and their roles."
          count={`${users.length} users`}
          search={
            <UsersFilterBar
              filters={filters}
              groupFilterOptions={userGroupFilterOptions(groups)}
            />
          }
          actions={<AddUserButton onClick={openAdd} />}
        />

        <UsersTable
          users={filters.filteredUsers}
          deactivatePending={deactivateUserMut.isPending}
          activatePending={activateUserMut.isPending}
          onEdit={openEdit}
          onDeactivate={(user) => deactivateUserMut.mutate({ userId: user.id })}
          onActivate={(user) => activateUserMut.mutate({ userId: user.id })}
          onDelete={openDelete}
        />
        {filters.filteredUsers.length === 0 && <UsersEmptyState />}
      </div>

      {showDialog && (
        <UserEditDialog
          editingUser={editingUser}
          form={form}
          onFormChange={setForm}
          groupOptions={groupOptions}
          activeGroups={activeGroups}
          groups={groups}
          canSave={canSave}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => setShowDialog(false)}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Delete User?"
        preview={deleteTarget ? deleteTarget.name : ""}
        reversible={false}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        triggerRef={deleteTriggerRef}
      />
    </>
  );
}

// A group move applies to future work only; archived report snapshots keep the
// old group, so the move is confirmed once rather than silently applied.
function confirmGroupChange(
  editingUser: MockUser | null,
  form: UserFormData,
): boolean {
  if (!editingUser || form.groupId === editingUser.groupId) return true;
  return window.confirm(
    "Change this user's group? The change applies to future work only; archived report snapshots stay unchanged.",
  );
}

// The picker lists active groups plus — only while editing a user who still
// sits in an archived one — that archived group, so the form never drops it.
function useUserFormGroups(groups: MockGroup[], selectedGroupId: string) {
  const activeGroups = useMemo(
    () => groups.filter((group) => !group.archived),
    [groups],
  );
  const groupOptions = useMemo(() => {
    if (
      !selectedGroupId ||
      activeGroups.some((group) => group.id === selectedGroupId)
    ) {
      return activeGroups;
    }
    const assignedArchivedGroup = groups.find(
      (group) => group.id === selectedGroupId,
    );
    return assignedArchivedGroup
      ? [...activeGroups, assignedArchivedGroup]
      : activeGroups;
  }, [activeGroups, selectedGroupId, groups]);
  return { activeGroups, groupOptions };
}

function useUsersFilterState(users: MockUser[]) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("active");
  const filteredUsers = useMemo(
    () =>
      filterAdminUsers(users, {
        search,
        role: roleFilter,
        groupId: groupFilter,
        status: statusFilter,
      }),
    [search, roleFilter, groupFilter, statusFilter, users],
  );
  return {
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    groupFilter,
    setGroupFilter,
    statusFilter,
    setStatusFilter,
    filteredUsers,
  };
}

function UsersFilterBar({
  filters,
  groupFilterOptions,
}: {
  readonly filters: ReturnType<typeof useUsersFilterState>;
  readonly groupFilterOptions: ReturnType<typeof userGroupFilterOptions>;
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
        onChange={filters.setRoleFilter}
        options={USER_ROLE_FILTER_OPTIONS}
        testId="users-role-filter"
        ariaLabel="Filter by role"
      />
      <TabFilter
        value={filters.groupFilter}
        onChange={filters.setGroupFilter}
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
      className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
      aria-label="Add new user"
    >
      <PlusIcon />
      Add User
    </button>
  );
}

function UsersEmptyState() {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
      No users match the search.
    </div>
  );
}
