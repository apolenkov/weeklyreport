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
  readonly publishConfirm: PeriodListItem | null;
  readonly publishIsPending: boolean;
  readonly onClosePublish: () => void;
  readonly onConfirmPublish: () => void;
  readonly reopenConfirm: PeriodListItem | null;
  readonly reopenIsPending: boolean;
  readonly onCloseReopen: () => void;
  readonly onConfirmReopen: () => void;
  readonly deleteConfirm: PeriodListItem | null;
  readonly deleteIsPending: boolean;
  readonly onCloseDelete: () => void;
  readonly onConfirmDelete: () => void;
}

type PeriodConfirmDialogsProps = Pick<
  PeriodsTabDialogsProps,
  | "publishConfirm"
  | "publishIsPending"
  | "onClosePublish"
  | "onConfirmPublish"
  | "reopenConfirm"
  | "reopenIsPending"
  | "onCloseReopen"
  | "onConfirmReopen"
  | "deleteConfirm"
  | "deleteIsPending"
  | "onCloseDelete"
  | "onConfirmDelete"
>;

function PeriodConfirmDialogs({
  publishConfirm,
  publishIsPending,
  onClosePublish,
  onConfirmPublish,
  reopenConfirm,
  reopenIsPending,
  onCloseReopen,
  onConfirmReopen,
  deleteConfirm,
  deleteIsPending,
  onCloseDelete,
  onConfirmDelete,
}: PeriodConfirmDialogsProps) {
  return (
    <>
      {publishConfirm && (
        <ConfirmationDialog
          open={true}
          title="Publish this period?"
          description={`${publishConfirm.weekLabel ?? formatWeekLabel(publishConfirm.periodStart)} (${formatPeriodRangeWithYear(publishConfirm.periodStart, publishConfirm.periodEnd)}) will be published immediately, without waiting for the deadline. Leads can no longer edit this period.`}
          confirmLabel={publishIsPending ? "Publishing…" : "Publish"}
          testId="periods-publish-dialog"
          isPending={publishIsPending}
          onClose={onClosePublish}
          onConfirm={onConfirmPublish}
        />
      )}

      {reopenConfirm && (
        <ConfirmationDialog
          open={true}
          title="Reopen this period?"
          description="The published report will be unlocked. Leads will be able to edit their sections again. Sections they already submitted return to draft and must be submitted again. The current published version will be replaced when you publish again."
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

export function PeriodsTabDialogs({
  showCreate,
  onCancelCreate,
  onSubmitCreate,
  createIsPending,
  editingRow,
  onCancelEdit,
  onSubmitEdit,
  editIsPending,
  publishConfirm,
  publishIsPending,
  onClosePublish,
  onConfirmPublish,
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

      <PeriodConfirmDialogs
        publishConfirm={publishConfirm}
        publishIsPending={publishIsPending}
        onClosePublish={onClosePublish}
        onConfirmPublish={onConfirmPublish}
        reopenConfirm={reopenConfirm}
        reopenIsPending={reopenIsPending}
        onCloseReopen={onCloseReopen}
        onConfirmReopen={onConfirmReopen}
        deleteConfirm={deleteConfirm}
        deleteIsPending={deleteIsPending}
        onCloseDelete={onCloseDelete}
        onConfirmDelete={onConfirmDelete}
      />
    </>
  );
}
