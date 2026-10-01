"use client";

import type { ProjectActivity } from "@customreport/shared";
import { useRef } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";
import type { ActivityFormData } from "../model/activity-form";
import type { AdminGroupView, AdminProductView } from "../model/admin-types";
import { ActivityFormFields } from "./activity-form-fields";
import { AdminEntityDialogActions } from "./admin-entity-dialog-actions";

interface ActivityEditDialogProps {
  readonly editingActivity: ProjectActivity | null;
  readonly form: ActivityFormData;
  readonly onFormChange: (form: ActivityFormData) => void;
  readonly groups: readonly AdminGroupView[];
  readonly products: readonly AdminProductView[];
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly onSave: () => void;
  readonly onClose: () => void;
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

  const dialogTitle = editingActivity ? "Edit activity" : "Add activity";
  return (
    <DialogSurface
      surfaceRef={surfaceRef}
      onDismiss={closeIfIdle}
      surfaceClassName="animate-scale-in mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
      ariaLabel={dialogTitle}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isSaving && canSave) onSave();
        }}
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {dialogTitle}
        </h3>
        <fieldset disabled={isSaving} className="contents">
          <ActivityFormFields
            form={form}
            onFormChange={onFormChange}
            groups={groups}
            products={products}
            groupLockedByLeads={(editingActivity?.leadIds.length ?? 0) > 0}
          />
        </fieldset>
        <AdminEntityDialogActions
          saveLabel={editingActivity !== null ? "Save changes" : "Add activity"}
          canSave={canSave}
          isSaving={isSaving}
          onClose={closeIfIdle}
        />
      </form>
    </DialogSurface>
  );
}
