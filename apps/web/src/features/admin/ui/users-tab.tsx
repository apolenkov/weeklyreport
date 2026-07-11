"use client";

import type { DbRole } from "@customreport/shared";
import { ROLE_LABEL, sessionRoleSchema, shortName } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";
import { useDialogFocus } from "../../../lib/use-dialog-focus";
import type { MockGroup, MockUser } from "../../../shared/lib/admin-mock-data";
import { toAdminUserInput } from "../model/admin";
import { TabFilter, TabHeader, TabSearch } from "./tab-header";

interface UserFormData {
  lastName: string;
  firstName: string;
  middleName: string;
  position: string;
  email: string;
  role: DbRole;
  groupId: string;
}

function emptyForm(groups: readonly MockGroup[]): UserFormData {
  return {
    lastName: "",
    firstName: "",
    middleName: "",
    position: "",
    email: "",
    role: "lead",
    groupId:
      groups.find((group) => !group.archived)?.id ?? groups.at(0)?.id ?? "",
  };
}

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

  // Save the trigger element so the shared focus primitive can restore focus
  // to it when the dialog closes (Escape, Cancel, backdrop, save success).
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);

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

  // Focus trap + Escape-to-close + restore-to-trigger via the shared primitive.
  useDialogFocus({
    open: showDialog,
    onClose: () => setShowDialog(false),
    containerRef: dialogSurfaceRef,
    triggerRef: dialogTriggerRef,
  });

  const saveUserMut = useMutation(
    trpc.admin.saveUser.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("User saved");
        setShowDialog(false);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const deleteUserMut = useMutation(
    trpc.admin.deleteUser.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("User deleted");
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  // deactivate/activate mutations with immediate Redis session revocation
  // on the backend.
  const deactivateUserMut = useMutation(
    trpc.admin.deactivateUser.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("User deactivated");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const activateUserMut = useMutation(
    trpc.admin.activateUser.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("User activated");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  function openAdd() {
    dialogTriggerRef.current = document.activeElement as HTMLElement;
    setEditingUser(null);
    setForm(emptyForm(groups));
    setShowDialog(true);
  }

  function openEdit(user: MockUser) {
    dialogTriggerRef.current = document.activeElement as HTMLElement;
    setEditingUser(user);
    setForm({
      lastName: user.lastName,
      firstName: user.firstName,
      middleName: user.middleName ?? "",
      position: user.position ?? "",
      email: user.email,
      role: user.role,
      groupId: user.groupId,
    });
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
    if (deleteTarget) {
      deleteUserMut.mutate({ userId: deleteTarget.id });
    }
  }

  const isSaving = saveUserMut.isPending;
  const isDeleting = deleteUserMut.isPending;
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

        {/* Users table */}
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-left text-sm" data-testid="users-table">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Name
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Email
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Role
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Group
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Position
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]${!user.isActive ? " opacity-60" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
                    <span className="flex items-center gap-2">
                      {shortName(user)}
                      {!user.isActive && (
                        <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-500">
                          inactive
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {user.department}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {user.position ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[rgba(0,117,74,0.3)] hover:bg-[var(--color-success)]"
                        aria-label={`Edit ${user.name}`}
                      >
                        Edit
                      </button>
                      {user.isActive ? (
                        <button
                          type="button"
                          onClick={() =>
                            deactivateUserMut.mutate({ userId: user.id })
                          }
                          disabled={deactivateUserMut.isPending}
                          className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-amber-600 transition-colors hover:border-[rgba(180,100,0,0.3)] hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Deactivate ${user.name}`}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            activateUserMut.mutate({ userId: user.id })
                          }
                          disabled={activateUserMut.isPending}
                          className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[rgba(0,117,74,0.3)] hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Activate ${user.name}`}
                        >
                          Activate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(user)}
                        className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-destructive)] transition-colors hover:border-[rgba(200,32,20,0.3)] hover:bg-red-50"
                        aria-label={`Delete ${user.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            No users match the search.
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={() => setShowDialog(false)}
          role="presentation"
          data-testid="crud-sheet"
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops mouse-click propagation to the backdrop; the dialog is keyboard-closable via Escape + Cancel button */}
          <div
            ref={dialogSurfaceRef}
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={editingUser ? "Edit user" : "Add user"}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              {editingUser ? "Edit User" : "Add User"}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="user-last-name"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Last name
                </label>
                <input
                  id="user-last-name"
                  type="text"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
                  autoFocus
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div>
                <label
                  htmlFor="user-first-name"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  First name
                </label>
                <input
                  id="user-first-name"
                  type="text"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div>
                <label
                  htmlFor="user-middle-name"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Middle name
                </label>
                <input
                  id="user-middle-name"
                  type="text"
                  value={form.middleName}
                  onChange={(e) =>
                    setForm({ ...form, middleName: e.target.value })
                  }
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div>
                <label
                  htmlFor="user-position"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Position
                </label>
                <input
                  id="user-position"
                  type="text"
                  value={form.position}
                  onChange={(e) =>
                    setForm({ ...form, position: e.target.value })
                  }
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div>
                <label
                  htmlFor="user-email"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Email
                </label>
                <input
                  id="user-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div>
                <label
                  htmlFor="user-role"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Role
                </label>
                <select
                  id="user-role"
                  value={form.role}
                  onChange={(e) => {
                    const role = e.target.value as DbRole;
                    setForm({
                      ...form,
                      role,
                      groupId:
                        role === "viewer"
                          ? ""
                          : form.groupId ||
                            activeGroups[0]?.id ||
                            groups[0]?.id ||
                            "",
                    });
                  }}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                >
                  <option value="lead">Lead</option>
                  <option value="head">Head</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="user-group"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Owning group
                </label>
                <select
                  id="user-group"
                  value={form.groupId}
                  onChange={(e) =>
                    setForm({ ...form, groupId: e.target.value })
                  }
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                  disabled={form.role === "viewer" || groupOptions.length === 0}
                >
                  {form.role === "viewer" && (
                    <option value="">No owning group</option>
                  )}
                  {groupOptions.length === 0 && (
                    <option value="">No active groups configured</option>
                  )}
                  {groupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.archived ? `${group.name} (archived)` : group.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                disabled={isSaving}
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "Saving…"
                  : editingUser
                    ? "Save Changes"
                    : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-sm rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete"
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              Delete User?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Delete {deleteTarget.name}? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-destructive)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Helper components ----

function RoleBadge({ role }: { readonly role: DbRole }) {
  const styles: Record<DbRole, { bg: string; text: string }> = {
    lead: { bg: "var(--color-success)", text: "var(--color-primary)" },
    head: { bg: "#e8e0f0", text: "#6b21a8" },
    admin: { bg: "#fef3c7", text: "#92400e" },
    viewer: { bg: "var(--color-muted)", text: "var(--color-muted-foreground)" },
  };
  const s = styles[role];

  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
