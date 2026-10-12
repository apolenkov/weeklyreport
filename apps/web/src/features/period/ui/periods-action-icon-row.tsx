import type { PeriodListItem } from "@weeklyreport/shared";

import { formatPeriodRangeWithYear } from "../../../shared/lib/format/format-date";
import {
  ArchiveIcon,
  DeleteIcon,
  EditIcon,
  IconButton,
  PublishIcon,
  ReopenIcon,
  UnarchiveIcon,
} from "./periods-tab-icons";

export interface PeriodActionHandlers {
  readonly onPublish: (row: PeriodListItem) => void;
  readonly onReopen: (row: PeriodListItem) => void;
  readonly onArchive: (row: PeriodListItem) => void;
  readonly onUnarchive: (row: PeriodListItem) => void;
  readonly onDelete: (row: PeriodListItem) => void;
  readonly onEdit: (row: PeriodListItem) => void;
}

function periodRange(row: PeriodListItem): string {
  return formatPeriodRangeWithYear(row.periodStart, row.periodEnd);
}

// Names the period so identical icon buttons stay distinct across rows.
function actionLabel(label: string, row: PeriodListItem): string {
  return `${label}: ${periodRange(row)}`;
}

// Publish/reopen/archive/unarchive — the lifecycle transitions, each shown
// only in the state that admits it.
function PeriodStateActions({
  row,
  onPublish,
  onReopen,
  onArchive,
  onUnarchive,
}: {
  readonly row: PeriodListItem;
} & Pick<
  PeriodActionHandlers,
  "onPublish" | "onReopen" | "onArchive" | "onUnarchive"
>) {
  return (
    <>
      {row.periodState === "open" && (
        <IconButton
          testId={`action-publish-${row.id}`}
          label={actionLabel("Publish now", row)}
          onClick={() => onPublish(row)}
          icon={<PublishIcon />}
        />
      )}
      {row.periodState === "published" && row.canReopen && (
        <IconButton
          testId={`action-reopen-${row.id}`}
          label={actionLabel("Reopen period", row)}
          onClick={() => onReopen(row)}
          icon={<ReopenIcon />}
        />
      )}
      {row.canArchive && (
        <IconButton
          testId={`action-archive-${row.id}`}
          label={actionLabel("Archive period", row)}
          onClick={() => onArchive(row)}
          tone="danger"
          icon={<ArchiveIcon />}
        />
      )}
      {row.periodState === "archived" && (
        <IconButton
          testId={`action-unarchive-${row.id}`}
          label={actionLabel("Unarchive period", row)}
          onClick={() => onUnarchive(row)}
          icon={<UnarchiveIcon />}
        />
      )}
    </>
  );
}

function DeleteAction({
  row,
  onDelete,
}: {
  readonly row: PeriodListItem;
} & Pick<PeriodActionHandlers, "onDelete">) {
  // Mirrors the delete service: only an open, unarchived draft period can
  // be deleted — published, reopened, and every archived row stay disabled.
  const deleteDisabled =
    row.periodState === "published" ||
    row.periodState === "archived" ||
    row.periodStatus === "reopened";

  if (deleteDisabled) {
    return (
      <IconButton
        testId={`action-delete-${row.id}`}
        label={actionLabel(
          "Cannot delete a published, archived, or reopened period",
          row,
        )}
        onClick={() => {
          /* disabled buttons suppress clicks */
        }}
        icon={<DeleteIcon />}
        tone="danger"
        disabled={true}
      />
    );
  }
  return (
    <IconButton
      testId={`action-delete-${row.id}`}
      label={actionLabel("Delete period", row)}
      onClick={() => onDelete(row)}
      icon={<DeleteIcon />}
      tone="danger"
    />
  );
}

export function ActionIconRow({
  row,
  onPublish,
  onReopen,
  onArchive,
  onUnarchive,
  onDelete,
  onEdit,
}: {
  readonly row: PeriodListItem;
} & PeriodActionHandlers) {
  return (
    <div
      className="inline-flex items-center gap-1"
      role="group"
      aria-label={`Actions for ${periodRange(row)}`}
      data-testid={`action-icons-${row.id}`}
    >
      <IconButton
        testId={`action-edit-${row.id}`}
        label={actionLabel("Edit period", row)}
        onClick={() => onEdit(row)}
        icon={<EditIcon />}
      />
      <PeriodStateActions
        row={row}
        onPublish={onPublish}
        onReopen={onReopen}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />
      <DeleteAction row={row} onDelete={onDelete} />
    </div>
  );
}
