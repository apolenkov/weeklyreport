import type { PeriodListItem } from "@customreport/shared";

import {
  ArchiveIcon,
  DeleteIcon,
  EditIcon,
  IconButton,
  PublishIcon,
  ReopenIcon,
  UnarchiveIcon,
} from "./periods-tab-icons";
import type { PeriodTableProps } from "./periods-tab-table";

type PeriodActionHandlers = Omit<PeriodTableProps, "rows" | "testIdPrefix">;

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
          label="Publish now"
          onClick={() => onPublish(row)}
          icon={<PublishIcon />}
        />
      )}
      {row.periodState === "published" && row.canReopen && (
        <IconButton
          testId={`action-reopen-${row.id}`}
          label="Reopen period"
          onClick={() => onReopen(row)}
          icon={<ReopenIcon />}
        />
      )}
      {row.canArchive && (
        <IconButton
          testId={`action-archive-${row.id}`}
          label="Archive period"
          onClick={() => onArchive(row)}
          tone="danger"
          icon={<ArchiveIcon />}
        />
      )}
      {row.periodState === "archived" && (
        <IconButton
          testId={`action-unarchive-${row.id}`}
          label="Unarchive period"
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
  // Mirrors the delete service: only a published report (live or archived)
  // and a reopened one are protected — an archived DRAFT stays deletable
  // without a detour through unarchive.
  const deleteDisabled =
    row.periodState === "published" ||
    (row.periodState === "archived" && row.periodStatus === "published") ||
    row.periodStatus === "reopened";

  if (deleteDisabled) {
    return (
      <IconButton
        testId={`action-delete-${row.id}`}
        label="Cannot delete a published or reopened period"
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
      label="Delete period"
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
      aria-label={`Actions for period ${row.id}`}
      data-testid={`action-icons-${row.id}`}
    >
      <IconButton
        testId={`action-edit-${row.id}`}
        label="Edit period"
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
