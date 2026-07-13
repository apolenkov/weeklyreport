"use client";

import { ROLE_LABEL, sessionRoleSchema } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";
import type { MockGroup, MockUser } from "../../../shared/lib/admin-mock-data";
import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import { PlusIcon } from "../../../shared/ui/icons";
import { toAdminUserInput } from "../model/admin";
import { emptyForm, formFromUser, type UserFormData } from "../model/user-form";
import { TabFilter, TabHeader, TabSearch } from "./tab-header";
import { UserEditDialog } from "./user-edit-dialog";
import { UsersTable } from "./users-table";

// role quick-filter options — declared module-level so no per-render alloc
const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  ...sessionRoleSchema.options.map((role) => ({
    value: role,
    label: ROLE_LABEL[role],
  })),
];

// status quick-filter — default "active" hides deactivated users on load
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
] as const;
type StatusFilterValue = (typeof STATUS_OPTIONS)[number]["value"];

interface UsersTabProps {
  readonly users: MockUser[];
  readonly groups: MockGroup[];
}

export function UsersTab({ users, groups }: UsersTabProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [editingUser, setEditingUser] = useState<MockUser | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MockUser | null>(null);
  const [form, setForm] = useState<UserFormData>(() => emptyForm(groups));
  const [search, setSearch] = useState("");
  // role quick-filter ("" = all roles)
  const [roleFilter, setRoleFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  // status quick-filter (default "active" — hides deactivated on load)
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("active");

  const activeGroups = useMemo(
    () => groups.filter((group) => !group.archived),
    [groups],
  );
  const groupOptions = useMemo(() => {
    if (
      !form.groupId ||
      activeGroups.some((group) => group.id === form.groupId)
    ) {
      return activeGroups;
    }
    const assignedArchivedGroup = groups.find(
      (group) => group.id === form.groupId,
    );
    return assignedArchivedGroup
      ? [...activeGroups, assignedArchivedGroup]
      : activeGroups;
  }, [activeGroups, form.groupId, groups]);
  const groupFilterOptions = useMemo(
    () => [
      { value: "", label: "All groups" },
      ...groups.map((group) => ({ value: group.id, label: group.name })),
    ],
    [groups],
  );

  // Shared toast+refetch success and error handlers — every admin mutation
  // invalidates the admin cache and surfaces the error message identically.
  const onError = (err: { message: string }) => toast.error(err.message);
  const onSuccess = (message: string, after?: () => void) => () => {
    invalidateAdmin(qc, trpc);
    toast.success(message);
    after?.();
  };

  const saveUserMut = useMutation(
    trpc.admin.saveUser.mutationOptions({
      onSuccess: onSuccess("User saved", () => setShowDialog(false)),
      onError,
    }),
  );

  const deleteUserMut = useMutation(
    trpc.admin.deleteUser.mutationOptions({
      onSuccess: onSuccess("User deleted"),
      onError,
    }),
  );

  // deactivate/activate mutations with immediate Redis session revocation
  // on the backend.
  const deactivateUserMut = useMutation(
    trpc.admin.deactivateUser.mutationOptions({
      onSuccess: onSuccess("User deactivated"),
      onError,
    }),
  );

  const activateUserMut = useMutation(
    trpc.admin.activateUser.mutationOptions({
      onSuccess: onSuccess("User activated"),
      onError,
    }),
  );

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
    if (
      editingUser &&
      form.groupId !== editingUser.groupId &&
      !window.confirm(
        "Change this user's group? The change applies to future work only; archived report snapshots stay unchanged.",
      )
    ) {
      return;
    }
    saveUserMut.mutate(toAdminUserInput(form, editingUser?.id));
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteUserMut.mutate({ userId: deleteTarget.id });
    setDeleteTarget(null);
  }

  const isSaving = saveUserMut.isPending;
  const canSave =
    form.lastName.trim().length > 0 &&
    form.firstName.trim().length > 0 &&
    (form.role === "viewer" || form.groupId.length > 0) &&
    !isSaving;
  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (groupFilter && user.groupId !== groupFilter) return false;
      if (statusFilter === "active" && !user.isActive) return false;
      if (statusFilter === "inactive" && user.isActive) return false;
      if (!needle) return true;
      return [
        user.name,
        user.email,
        user.role,
        user.department,
        user.position ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [search, roleFilter, groupFilter, statusFilter, users]);

  return (
    <>
      <div className="space-y-4">
        <TabHeader
          title="Users"
          description="Manage group members and their roles."
          count={`${users.length} users`}
          search={
            <>
              <TabFilter
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilterValue)}
                options={STATUS_OPTIONS}
                testId="users-status-filter"
                ariaLabel="Filter by status"
              />
              <TabFilter
                value={roleFilter}
                onChange={setRoleFilter}
                options={ROLE_OPTIONS}
                testId="users-role-filter"
                ariaLabel="Filter by role"
              />
              <TabFilter
                value={groupFilter}
                onChange={setGroupFilter}
                options={groupFilterOptions}
                testId="users-group-filter"
                ariaLabel="Filter by group"
              />
              <TabSearch
                value={search}
                onChange={setSearch}
                placeholder="Search users…"
                testId="users-search"
                ariaLabel="Search users"
              />
            </>
          }
          actions={
            <button
              type="button"
              onClick={openAdd}
              className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
              aria-label="Add new user"
            >
              <PlusIcon />
              Add User
            </button>
          }
        />

        <UsersTable
          users={filteredUsers}
          deactivatePending={deactivateUserMut.isPending}
          activatePending={activateUserMut.isPending}
          onEdit={openEdit}
          onDeactivate={(user) => deactivateUserMut.mutate({ userId: user.id })}
          onActivate={(user) => activateUserMut.mutate({ userId: user.id })}
          onDelete={setDeleteTarget}
        />
        {filteredUsers.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            No users match the search.
          </div>
        )}
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
      />
    </>
  );
}
