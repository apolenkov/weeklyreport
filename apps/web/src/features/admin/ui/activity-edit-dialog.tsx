"use client";

import type { ProjectActivity } from "@customreport/shared";
import { useRef } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import type { ActivityFormData } from "../model/activity-form";
import type { MockGroup, MockProduct } from "../model/admin-types";
import { ActivityFormFields } from "./activity-form-fields";

interface ActivityEditDialogProps {
  readonly editingActivity: ProjectActivity | null;
  readonly form: ActivityFormData;
  readonly onFormChange: (form: ActivityFormData) => void;
  readonly groups: readonly MockGroup[];
  readonly products: readonly MockProduct[];
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

function ActivityDialogFooter({
  isEditing,
  canSave,
  isSaving,
  onSave,
  onClose,
}: {
  readonly isEditing: boolean;
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly onSave: () => void;
  readonly onClose: () => void;
}) {
  return (
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
        disabled={isSaving || !canSave}
        className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Add Activity"}
      </button>
    </div>
  );
}

export function ActivityEditDialog({
  editingActivity,
  form,
  onFormChange,
  groups,
  products,
  canSave,
  isSaving,
  onSave,
  onClose,
}: ActivityEditDialogProps) {
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
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops backdrop close-propagation; no keyboard equivalent needed (dialog closes via Escape + Cancel button) */}
      <div
        ref={surfaceRef}
        className="animate-scale-in mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={editingActivity ? "Edit activity" : "Add activity"}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {editingActivity ? "Edit Activity" : "Add Activity"}
        </h3>
        <ActivityFormFields
          form={form}
          onFormChange={onFormChange}
          groups={groups}
          products={products}
          groupLockedByLeads={(editingActivity?.leadIds.length ?? 0) > 0}
        />
        <ActivityDialogFooter
          isEditing={editingActivity !== null}
          canSave={canSave}
          isSaving={isSaving}
          onSave={onSave}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
