"use client";

import type { PeriodListItem } from "@customreport/shared";

import { ConfirmationDialog } from "../../../shared/ui/confirmation-dialog";
import type { CreatePeriodValues } from "./periods-tab-dialog";
import { CreatePeriodDialog } from "./periods-tab-dialog";

interface PeriodsTabDialogsProps {
  readonly showCreate: boolean;
  readonly onCancelCreate: () => void;
  readonly onSubmitCreate: (values: CreatePeriodValues) => void;
  readonly createIsPending: boolean;
  readonly editingRow: PeriodListItem | null;
  readonly onCancelEdit: () => void;
  readonly onSubmitEdit: (values: CreatePeriodValues) => void;
  readonly editIsPending: boolean;
  readonly deleteConfirm: PeriodListItem | null;
  readonly deleteIsPending: boolean;
  readonly onCloseDelete: () => void;
  readonly onConfirmDelete: () => void;
}

/**
 * Bundles the Periods tab's three modals — create, edit (same component,
 * `mode` discriminates), and delete confirmation — so the tab itself only
 * wires state in and mutation callbacks out.
 */
export function PeriodsTabDialogs({
  showCreate,
  onCancelCreate,
  onSubmitCreate,
  createIsPending,
  editingRow,
  onCancelEdit,
  onSubmitEdit,
  editIsPending,
  deleteConfirm,
  deleteIsPending,
  onCloseDelete,
  onConfirmDelete,
}: PeriodsTabDialogsProps) {
  return (
    <>
      {showCreate && (
        <CreatePeriodDialog
          mode="create"
          onCancel={onCancelCreate}
          onSubmit={onSubmitCreate}
          isPending={createIsPending}
        />
      )}

      {editingRow && (
        <CreatePeriodDialog
          mode="edit"
          initialValues={editingRow}
          onCancel={onCancelEdit}
          onSubmit={onSubmitEdit}
          isPending={editIsPending}
        />
      )}

      {deleteConfirm && (
        <ConfirmationDialog
          open={true}
          title="Delete period?"
          description="This will permanently delete the period and all draft sections. This action cannot be undone."
          confirmLabel={deleteIsPending ? "Deleting…" : "Delete"}
          variant="destructive"
          testId="periods-delete-dialog"
          isPending={deleteIsPending}
          onClose={onCloseDelete}
          onConfirm={onConfirmDelete}
        />
      )}
    </>
  );
}
