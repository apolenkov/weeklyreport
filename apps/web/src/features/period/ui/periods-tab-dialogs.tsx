"use client";

import type { PeriodListItem } from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  formatWeekLabel,
} from "../../../shared/lib/format/format-date";
import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";
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
  readonly reopenConfirm: PeriodListItem | null;
  readonly reopenIsPending: boolean;
  readonly onCloseReopen: () => void;
  readonly onConfirmReopen: () => void;
  readonly deleteConfirm: PeriodListItem | null;
  readonly deleteIsPending: boolean;
  readonly onCloseDelete: () => void;
  readonly onConfirmDelete: () => void;
}

export function PeriodsTabDialogs({
  showCreate,
  onCancelCreate,
  onSubmitCreate,
  createIsPending,
  editingRow,
  onCancelEdit,
  onSubmitEdit,
  editIsPending,
  reopenConfirm,
  reopenIsPending,
  onCloseReopen,
  onConfirmReopen,
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

      {reopenConfirm && (
        <ConfirmationDialog
          open={true}
          title="Reopen this period?"
          description="The published report will be unlocked. Leads will be able to edit their sections again. The current published version will be replaced when you publish again."
          confirmLabel={reopenIsPending ? "Reopening…" : "Reopen"}
          testId="periods-reopen-dialog"
          isPending={reopenIsPending}
          onClose={onCloseReopen}
          onConfirm={onConfirmReopen}
        />
      )}

      {deleteConfirm && (
        <ConfirmationDialog
          open={true}
          title="Delete period?"
          description={`${deleteConfirm.weekLabel ?? formatWeekLabel(deleteConfirm.periodStart)} (${formatPeriodRangeWithYear(deleteConfirm.periodStart, deleteConfirm.periodEnd)}) will be permanently deleted with all its draft sections. This action cannot be undone.`}
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
