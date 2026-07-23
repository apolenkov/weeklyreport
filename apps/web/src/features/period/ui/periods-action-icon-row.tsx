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

/**
 * Inline icon-button row for per-row lifecycle actions. Icons sit directly
 * in the row (simpler for users than a kebab dropdown).
 *
 * Visibility rules (driven by server-precomputed flags so the UI does
 * not have to know the reopen-policy or archive-state rules):
 *
 *   - Edit       — unconditional. The Edit dialog only moves dates /
 *                  label, no state transition required.
 *   - Publish    — only when `periodState === 'open'`. Matches the
 *                  /head/report Publish button (auto-publisher handles
 *                  it for un-clicked rows).
 *   - Reopen     — only when `periodState === 'published' && canReopen`.
 *                  `canReopen` is server-computed from the master switch
 *                  + reopen-window math.
 *   - Archive    — only when `canArchive` (skips already-archived rows).
 *   - Unarchive  — only when `periodState === 'archived'`.
 *
 * Each icon is 32×32 with a hover state + `aria-label` + `title`. The
 * `data-testid` shape stays `action-<verb>-{id}` so tests asserting on
 * `action-publish-{id}` etc. resolve.
 */
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
} & Omit<PeriodTableProps, "rows" | "testIdPrefix">) {
  // Mirrors the delete service: only a published report (live or archived)
  // and a reopened one are protected — an archived DRAFT stays deletable
  // without a detour through unarchive.
  const deleteDisabled =
    row.periodState === "published" ||
    (row.periodState === "archived" && row.periodStatus === "published") ||
    row.periodStatus === "reopened";

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
      {deleteDisabled ? (
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
      ) : (
        <IconButton
          testId={`action-delete-${row.id}`}
          label="Delete period"
          onClick={() => onDelete(row)}
          icon={<DeleteIcon />}
          tone="danger"
        />
      )}
    </div>
  );
}
