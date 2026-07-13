"use client";

import type { DbRole } from "@customreport/shared";
import { useRef } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import type { MockGroup, MockUser } from "../../../shared/lib/admin-mock-data";
import type { UserFormData } from "../model/user-form";

interface UserEditDialogProps {
  readonly editingUser: MockUser | null;
  readonly form: UserFormData;
  readonly onFormChange: (form: UserFormData) => void;
  readonly groupOptions: readonly MockGroup[];
  readonly activeGroups: readonly MockGroup[];
  readonly groups: readonly MockGroup[];
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
      data-testid="crud-sheet"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops mouse-click propagation to the backdrop; the dialog is keyboard-closable via Escape + Cancel button */}
      <div
        ref={surfaceRef}
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
                onFormChange({ ...form, lastName: e.target.value })
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
                onFormChange({ ...form, firstName: e.target.value })
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
                onFormChange({ ...form, middleName: e.target.value })
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
                onFormChange({ ...form, position: e.target.value })
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
              onChange={(e) => onFormChange({ ...form, email: e.target.value })}
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
                onFormChange({
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
                onFormChange({ ...form, groupId: e.target.value })
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
            onClick={onClose}
            disabled={isSaving}
            className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving…" : editingUser ? "Save Changes" : "Add User"}
          </button>
        </div>
      </div>
    </div>
  );
}
