"use client";

import { useRef } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import type { MockGroup, MockProduct, MockUser } from "../model/admin-types";
import type { GroupFormData } from "../model/group-form";
import { GroupProductsEditor } from "./group-products-editor";

interface GroupEditDialogProps {
  readonly editingGroup: MockGroup | null;
  readonly form: GroupFormData;
  readonly onFormChange: (form: GroupFormData) => void;
  readonly headCandidates: readonly MockUser[];
  readonly products: readonly MockProduct[];
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

export function GroupEditDialog({
  editingGroup,
  form,
  onFormChange,
  headCandidates,
  products,
  canSave,
  isSaving,
  onSave,
  onClose,
}: GroupEditDialogProps) {
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={closeIfIdle}
      role="presentation"
      data-testid="crud-sheet"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops backdrop close-propagation; no keyboard equivalent needed (dialog closes via Escape + Cancel button) */}
      <div
        ref={surfaceRef}
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={editingGroup ? "Edit group" : "Add group"}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {editingGroup ? "Edit Group" : "Add Group"}
        </h3>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="group-name"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Name
            </label>
            <input
              id="group-name"
              type="text"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
              autoFocus
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="group-description"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Description
            </label>
            <textarea
              id="group-description"
              value={form.description}
              onChange={(e) =>
                onFormChange({ ...form, description: e.target.value })
              }
              rows={3}
              className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="group-leader"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Leader
            </label>
            <select
              id="group-leader"
              value={form.headUserId}
              onChange={(e) =>
                onFormChange({ ...form, headUserId: e.target.value })
              }
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            >
              <option value="">— No leader —</option>
              {headCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            {headCandidates.length === 0 && (
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                No users with role &lsquo;head&rsquo; or &lsquo;admin&rsquo;
                available.
              </p>
            )}
          </div>
          {editingGroup && (
            <div>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.archived}
                  onChange={(e) =>
                    onFormChange({ ...form, archived: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                />
                <span className="block text-sm">
                  <span className="font-medium text-[var(--color-foreground)]">
                    Archived
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                    Hidden from new user/group pickers; existing references keep
                    working.
                  </span>
                </span>
              </label>
            </div>
          )}
          {editingGroup && (
            <GroupProductsEditor
              groupId={editingGroup.id}
              products={products}
            />
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={closeIfIdle}
            disabled={isSaving}
            className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving…" : editingGroup ? "Save Changes" : "Add Group"}
          </button>
        </div>
      </div>
    </div>
  );
}
