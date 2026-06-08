"use client";

import type { PeriodListItem, PeriodState } from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  formatWeekLabel,
  joinPeriodLabel,
} from "../../lib/format-date";
import {
  ArchiveIcon,
  DeleteIcon,
  EditIcon,
  IconButton,
  PublishIcon,
  ReopenIcon,
  UnarchiveIcon,
} from "./periods-tab-icons";

export interface PeriodTableProps {
  readonly rows: PeriodListItem[];
  readonly testIdPrefix: "active" | "archive";
  readonly onPublish: (row: PeriodListItem) => void;
  readonly onReopen: (row: PeriodListItem) => void;
  readonly onArchive: (row: PeriodListItem) => void;
  readonly onUnarchive: (row: PeriodListItem) => void;
  // A27: delete opens a confirmation dialog before deletion.
  readonly onDelete: (row: PeriodListItem) => void;
  // UFB-067: row-level edit opens the dialog in edit-mode prefilled
  // from this row.
  readonly onEdit: (row: PeriodListItem) => void;
}

export function PeriodTable({
  rows,
  testIdPrefix,
  onPublish,
  onReopen,
  onArchive,
  onUnarchive,
  onDelete,
  onEdit,
}: PeriodTableProps) {
  return (
    <div
      className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]"
      data-testid={`periods-${testIdPrefix}-table`}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Period
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              State
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Progress
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Deadline
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <PeriodRow
              key={row.id}
              row={row}
              testIdPrefix={testIdPrefix}
              onPublish={onPublish}
              onReopen={onReopen}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodRow({
  row,
  testIdPrefix,
  onPublish,
  onReopen,
  onArchive,
  onUnarchive,
  onDelete,
  onEdit,
}: {
  readonly row: PeriodListItem;
  readonly testIdPrefix: "active" | "archive";
} & Omit<PeriodTableProps, "rows" | "testIdPrefix">) {
  const periodLabel = joinPeriodLabel(
    row.weekLabel ?? formatWeekLabel(row.periodStart),
    formatPeriodRangeWithYear(row.periodStart, row.periodEnd),
  );

  return (
    <tr
      data-testid={`periods-${testIdPrefix}-row-${row.id}`}
      data-period-state={row.periodState}
      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]"
    >
      <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
        {periodLabel}
      </td>
      <td className="px-4 py-3">
        <StateBadge state={row.periodState} />
        {row.periodStatus === "reopened" && (
          <span
            className="ml-2 inline-flex items-center rounded-[var(--radius-pill)] bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#92400e]"
            data-testid={`periods-row-${row.id}-reopened-badge`}
          >
            reopened
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <ProgressBadge
          submitted={row.submittedCount}
          total={row.totalCount}
          rowId={row.id}
        />
      </td>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
        {formatDate(row.deadline)}
      </td>
      <td className="px-4 py-3 text-right">
        <ActionIconRow
          row={row}
          onPublish={onPublish}
          onReopen={onReopen}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      </td>
    </tr>
  );
}

function StateBadge({ state }: { readonly state: PeriodState }) {
  const styles: Record<
    PeriodState,
    { bg: string; text: string; label: string }
  > = {
    scheduled: { bg: "#e5e7eb", text: "#374151", label: "scheduled" },
    open: {
      bg: "var(--color-success)",
      text: "var(--color-primary)",
      label: "open",
    },
    published: { bg: "#e8e0f0", text: "#6b21a8", label: "published" },
    archived: { bg: "#f3f4f6", text: "#6b7280", label: "archived" },
  };
  const s = styles[state];
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold capitalize"
      style={{ backgroundColor: s.bg, color: s.text }}
      data-testid={`state-badge-${state}`}
    >
      {s.label}
    </span>
  );
}

/**
 * Progress badge — `<submitted>/<total>` with a 3-tier color scale.
 * Used in the row instead of just a number so heads can scan the
 * lifecycle list and spot the lagging periods at a glance.
 */
function ProgressBadge({
  submitted,
  total,
  rowId,
}: {
  readonly submitted: number;
  readonly total: number;
  readonly rowId: string;
}) {
  // Edge case: total === 0 happens for newly minted periods before the
  // auto-creator provisioned the per-lead sections. Show `—` so the row
  // doesn't claim "0/0 complete" — that would imply 100% and mislead.
  if (total === 0) {
    return (
      <span
        className="text-xs text-[var(--color-muted-foreground)]"
        data-testid={`periods-row-${rowId}-progress`}
      >
        —
      </span>
    );
  }
  const ratio = submitted / total;
  const tone = ratio >= 1 ? "success" : ratio >= 0.5 ? "amber" : "red";
  const colors = {
    success: { bg: "var(--color-success)", text: "var(--color-primary)" },
    amber: { bg: "#fef3c7", text: "#92400e" },
    red: { bg: "#fee2e2", text: "#991b1b" },
  } as const;
  const c = colors[tone];
  const pending = total - submitted;
  const tooltipText =
    pending > 0
      ? `${submitted} of ${total} leads submitted — ${pending} pending`
      : `All ${total} leads submitted`;
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold tabular-nums"
      style={{ backgroundColor: c.bg, color: c.text }}
      data-testid={`periods-row-${rowId}-progress`}
      data-progress-tone={tone}
      title={tooltipText}
    >
      {submitted}/{total}
    </span>
  );
}

/**
 * UFB-067: inline icon-button row for per-row lifecycle actions. Replaces
 * the previous 3-dot kebab dropdown (UAT-2026-05-11 feedback: «иконки
 * прямо в строке проще, чем выпадашка»).
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
function ActionIconRow({
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

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
