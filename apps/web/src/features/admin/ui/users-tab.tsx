"use client";

import { ConfirmDeleteDialog } from "../../../shared/ui/dialogs/confirm-delete-dialog";
import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";
import type { AdminGroupView, AdminUserView } from "../model/admin-types";
import { userGroupFilterOptions } from "../model/user-table-filters";
import { useUsersTabState } from "./use-users-tab-state";
import { UserEditDialog } from "./user-edit-dialog";
import { UsersTabHeader } from "./users-tab-header";
import { UsersTable } from "./users-table";

interface UsersTabProps {
  readonly users: AdminUserView[];
  readonly groups: AdminGroupView[];
}

export function UsersTab({ users, groups }: UsersTabProps) {
  const state = useUsersTabState(users, groups);

  return (
    <>
      <div className="space-y-4">
        <UsersTabHeader
          userCount={state.filters.filteredUsers.length}
          filters={state.filters}
          groupFilterOptions={userGroupFilterOptions(groups)}
          onAdd={state.openAdd}
        />

        <UsersTable
          users={state.filters.filteredUsers}
          deactivatePending={state.deactivatePending}
          activatePending={state.activatePending}
          onEdit={state.openEdit}
          onDeactivate={state.deactivateUser}
          onActivate={state.activateUser}
          onDelete={state.openDelete}
        />
        {state.filters.filteredUsers.length === 0 && (
          <UsersEmptyState hasData={users.length > 0} />
        )}
      </div>

      {state.showDialog && (
        <UserEditDialog
          editingUser={state.editingUser}
          form={state.form}
          onFormChange={state.setForm}
          groupOptions={state.groupOptions}
          activeGroups={state.activeGroups}
          canSave={state.canSave}
          isSaving={state.isSaving}
          onSave={state.handleSave}
          onClose={state.closeDialog}
        />
      )}

      <ConfirmDeleteDialog
        open={state.deleteTarget !== null}
        title="Delete user?"
        preview={state.deleteTarget ? state.deleteTarget.name : ""}
        reversible={false}
        confirmLabel="Delete"
        isPending={state.deletePending}
        onConfirm={state.handleDelete}
        onCancel={state.cancelDelete}
        triggerRef={state.deleteTriggerRef}
      />

      <GroupChangeDialog state={state} />
    </>
  );
}

function GroupChangeDialog({
  state,
}: {
  readonly state: ReturnType<typeof useUsersTabState>;
}) {
  return (
    <ConfirmationDialog
      open={state.showGroupChangeConfirm}
      title="Change this user's group?"
      description="The change applies to future work only; archived report snapshots stay unchanged."
      confirmLabel="Change group"
      isPending={state.isSaving}
      onConfirm={state.confirmGroupChange}
      onClose={state.cancelGroupChange}
    />
  );
}

function UsersEmptyState({ hasData }: { readonly hasData: boolean }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
      {hasData ? "No users match the search." : "No users yet."}
    </div>
  );
}
