"use client";

import { useRef } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import type { AdminGroupView, AdminUserView } from "../model/admin-types";
import type { UserFormData } from "../model/user-form";
import { UserEditDialogActions } from "./user-edit-dialog-actions";
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
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape-to-close + restore-to-trigger via the shared primitive.
  // The dialog mounts on open, so the hook self-captures the opener at first
  // render and restores focus to it on close.
  useDialogFocus({ open: true, onClose, containerRef: surfaceRef });

  return (
    <UserEditDialogShell
      surfaceRef={surfaceRef}
      title={editingUser ? "Edit User" : "Add User"}
      ariaLabel={editingUser ? "Edit user" : "Add user"}
      onClose={onClose}
    >
      <UserEditDialogFields
        form={form}
        onFormChange={onFormChange}
        groupOptions={groupOptions}
        activeGroups={activeGroups}
        groups={groups}
      />
      <UserEditDialogActions
        canSave={canSave}
        isSaving={isSaving}
        saveLabel={editingUser ? "Save Changes" : "Add User"}
        onSave={onSave}
        onClose={onClose}
      />
    </UserEditDialogShell>
  );
}
