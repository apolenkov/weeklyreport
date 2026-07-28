"use client";

import { useMemo, useRef, useState } from "react";

import { toAdminUserInput } from "../model/admin";
import type { AdminGroupView, AdminUserView } from "../model/admin-types";
import { emptyForm, formFromUser, type UserFormData } from "../model/user-form";
import {
  filterAdminUsers,
  type UserStatusFilter,
} from "../model/user-table-filters";
import { useUserMutations } from "../model/users-tab-mutations";

function changesUserGroup(
  editingUser: AdminUserView | null,
  form: UserFormData,
): boolean {
  return editingUser !== null && form.groupId !== editingUser.groupId;
}

function canSaveUser(form: UserFormData, isSaving: boolean): boolean {
  return (
    form.lastName.trim().length > 0 &&
    form.firstName.trim().length > 0 &&
    (form.role === "viewer" || form.groupId.length > 0) &&
    !isSaving
  );
}

// The picker lists active groups plus — only while editing a user who still
// sits in an archived one — that archived group, so the form never drops it.
function useUserFormGroups(groups: AdminGroupView[], selectedGroupId: string) {
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

export interface UsersFilterState {
  readonly search: string;
  readonly setSearch: (next: string) => void;
  readonly roleFilter: string;
  readonly setRoleFilter: (next: string) => void;
  readonly groupFilter: string;
  readonly setGroupFilter: (next: string) => void;
  readonly statusFilter: UserStatusFilter;
  readonly setStatusFilter: (next: UserStatusFilter) => void;
  readonly filteredUsers: AdminUserView[];
}

function useUsersFilterState(users: AdminUserView[]): UsersFilterState {
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

function useUserEditDialog(groups: AdminGroupView[]) {
  const [editingUser, setEditingUser] = useState<AdminUserView | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<UserFormData>(() => emptyForm(groups));
  const { activeGroups, groupOptions } = useUserFormGroups(
    groups,
    form.groupId,
  );

  return {
    editingUser,
    showDialog,
    form,
    setForm,
    activeGroups,
    groupOptions,
    closeDialog: () => setShowDialog(false),
    openAdd: () => {
      setEditingUser(null);
      setForm(emptyForm(groups));
      setShowDialog(true);
    },
    openEdit: (user: AdminUserView) => {
      setEditingUser(user);
      setForm(formFromUser(user));
      setShowDialog(true);
    },
  };
}

// The trigger element is stashed so the confirm dialog can restore focus to the
// row button it replaced; it is written on click only, never read while rendering.
function useUserDeletion(deleteUser: (userId: string) => void) {
  const [deleteTarget, setDeleteTarget] = useState<AdminUserView | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);

  return {
    deleteTarget,
    deleteTriggerRef,
    cancelDelete: () => setDeleteTarget(null),
    openDelete: (user: AdminUserView, trigger: HTMLButtonElement) => {
      deleteTriggerRef.current = trigger;
      setDeleteTarget(user);
    },
    handleDelete: () => {
      if (!deleteTarget) return;
      deleteUser(deleteTarget.id);
      setDeleteTarget(null);
    },
  };
}

export function useUsersTabState(
  users: AdminUserView[],
  groups: AdminGroupView[],
) {
  const dialog = useUserEditDialog(groups);
  const filters = useUsersFilterState(users);
  const { saveUserMut, deleteUserMut, deactivateUserMut, activateUserMut } =
    useUserMutations(dialog.closeDialog);
  const [pendingGroupChange, setPendingGroupChange] = useState<ReturnType<
    typeof toAdminUserInput
  > | null>(null);
  const deletion = useUserDeletion((userId) =>
    deleteUserMut.mutate({ userId }),
  );
  const isSaving = saveUserMut.isPending;

  return {
    ...dialog,
    ...deletion,
    filters,
    showGroupChangeConfirm: pendingGroupChange !== null,
    isSaving,
    canSave: canSaveUser(dialog.form, isSaving),
    deactivatePending: deactivateUserMut.isPending,
    activatePending: activateUserMut.isPending,
    handleSave: () => {
      const input = toAdminUserInput(dialog.form, dialog.editingUser?.id);
      if (changesUserGroup(dialog.editingUser, dialog.form)) {
        setPendingGroupChange(input);
        return;
      }
      saveUserMut.mutate(input);
    },
    confirmGroupChange: () => {
      if (pendingGroupChange === null) return;
      const input = pendingGroupChange;
      setPendingGroupChange(null);
      saveUserMut.mutate(input);
    },
    cancelGroupChange: () => setPendingGroupChange(null),
    deactivateUser: (user: AdminUserView) =>
      deactivateUserMut.mutate({ userId: user.id }),
    activateUser: (user: AdminUserView) =>
      activateUserMut.mutate({ userId: user.id }),
  };
}
