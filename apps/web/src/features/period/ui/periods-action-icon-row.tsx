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
 * UFB-067: inline icon-button row for per-row lifecycle actions (extracted
 * from periods-tab-table.tsx). Replaces the previous 3-dot kebab dropdown
 * (UAT-2026-05-11 feedback: «иконки прямо в строке проще, чем выпадашка»).
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
 *                  + reopen-window math (51-A AppSettings).
 *   - Archive    — only when `canArchive` (skips already-archived rows).
 *   - Unarchive  — only when `periodState === 'archived'`.
 *
 * Each icon is 32×32 with a hover state + `aria-label` + `title`. The
 * `data-testid` shape mirrors the previous kebab menu's item testIds so
 * existing tests that asserted on `action-publish-{id}` etc. still resolve;
 * the now-removed `action-menu-trigger-{id}` selector has no replacement
 * because the dropdown trigger no longer exists.
 *
 * No dropdown = no portal = no overflow clipping = the 51-B portal
 * workaround disappears with this refactor.
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
      {/* A27: Delete button. Show when not published, disabled when published. */}
      {row.periodStatus === "published" ? (
        <IconButton
          testId={`action-delete-${row.id}`}
          label="Cannot delete a published period"
          onClick={() => {
            /* intentionally empty: button is disabled for published periods, clicks are suppressed */
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
