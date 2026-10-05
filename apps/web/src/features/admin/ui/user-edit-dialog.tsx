"use client";

import { useRef } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import type { AdminGroupView, AdminUserView } from "../model/admin-types";
import { useCurrentUserId } from "../model/use-current-user-id";
import type { UserFormData } from "../model/user-form";
import { AdminEntityDialogActions } from "./admin-entity-dialog-actions";
import { UserEditDialogFields } from "./user-edit-dialog-fields";
import { UserEditDialogShell } from "./user-edit-dialog-shell";

interface UserEditDialogProps {
  readonly editingUser: AdminUserView | null;
  readonly form: UserFormData;
  readonly onFormChange: (form: UserFormData) => void;
  readonly groupOptions: readonly AdminGroupView[];
  readonly activeGroups: readonly AdminGroupView[];
  readonly groups: readonly AdminGroupView[];
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

export function UserEditDialog({
  editingUser,
  form,
  onFormChange,
  groupOptions,
  activeGroups,
  groups,
  canSave,
  isSaving,
  onSave,
  onClose,
}: UserEditDialogProps) {
  const currentUserId = useCurrentUserId();
  const isOwnAdminRow =
    editingUser !== null &&
    editingUser.id === currentUserId &&
    editingUser.role === "admin";
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeIfIdle = () => {
    if (!isSaving) onClose();
  };

  // Focus trap + Escape-to-close + restore-to-trigger via the shared primitive.
  // The dialog mounts on open, so the hook self-captures the opener at first
  // render and restores focus to it on close.
  useDialogFocus({
    open: true,
    onClose: closeIfIdle,
    containerRef: surfaceRef,
  });

  return (
    <UserEditDialogShell
      surfaceRef={surfaceRef}
      title={editingUser ? "Edit user" : "Add user"}
      ariaLabel={editingUser ? "Edit user" : "Add user"}
      onClose={closeIfIdle}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isSaving && canSave) onSave();
        }}
      >
        <fieldset disabled={isSaving} className="contents">
          <UserEditDialogFields
            form={form}
            onFormChange={onFormChange}
            groupOptions={groupOptions}
            activeGroups={activeGroups}
            groups={groups}
            roleLocked={isOwnAdminRow}
          />
        </fieldset>
        <AdminEntityDialogActions
          canSave={canSave}
          isSaving={isSaving}
          saveLabel={editingUser ? "Save changes" : "Add user"}
          onClose={closeIfIdle}
        />
      </form>
    </UserEditDialogShell>
  );
}
