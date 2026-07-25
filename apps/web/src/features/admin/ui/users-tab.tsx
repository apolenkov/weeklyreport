"use client";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import type { MockGroup, MockUser } from "../model/admin-types";
import { userGroupFilterOptions } from "../model/user-table-filters";
import { useUsersTabState } from "./use-users-tab-state";
import { UserEditDialog } from "./user-edit-dialog";
import { UsersTabHeader } from "./users-tab-header";
import { UsersTable } from "./users-table";

interface UsersTabProps {
  readonly users: MockUser[];
  readonly groups: MockGroup[];
}

/**
 * Users Tab.
 * @param props - The props argument.
 */
export function UsersTab({ users, groups }: UsersTabProps) {
  const state = useUsersTabState(users, groups);

  return (
    <>
      <div className="space-y-4">
        <UsersTabHeader
          userCount={users.length}
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
        {state.filters.filteredUsers.length === 0 && <UsersEmptyState />}
      </div>

      {state.showDialog && (
        <UserEditDialog
          editingUser={state.editingUser}
          form={state.form}
          onFormChange={state.setForm}
          groupOptions={state.groupOptions}
          activeGroups={state.activeGroups}
          groups={groups}
          canSave={state.canSave}
          isSaving={state.isSaving}
          onSave={state.handleSave}
          onClose={state.closeDialog}
        />
      )}

      <ConfirmDeleteDialog
        open={state.deleteTarget !== null}
        title="Delete User?"
        preview={state.deleteTarget ? state.deleteTarget.name : ""}
        reversible={false}
        confirmLabel="Delete"
        onConfirm={state.handleDelete}
        onCancel={state.cancelDelete}
        triggerRef={state.deleteTriggerRef}
      />
    </>
  );
}

function UsersEmptyState() {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
      No users match the search.
    </div>
  );
}
