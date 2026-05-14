"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { PeriodListItem, PeriodState } from "@customreport/shared";

import { formatPeriodRange } from "../../lib/format-date";
import { invalidateAdmin } from "../../lib/cache-keys";
import { useTRPC } from "../../lib/trpc-context";

import { TabHeader, TabSearch } from "./tab-header";

/**
 * UFB-052 (Phase 51-B), UFB-067: Admin → Periods tab.
 *
 *   ┌─ Active ────────────────────────────────────────────┐
 *   │  rows with periodState ∈ {scheduled, open, published}│
 *   │  primary panel, always rendered                      │
 *   └─────────────────────────────────────────────────────┘
 *
 *   ┌─ Archive [show ☐] ─────────────────────────────────┐
 *   │  rows with periodState = archived                  │
 *   │  collapsed by default; query is gated (opt-in)     │
 *   └────────────────────────────────────────────────────┘
 *
 * UFB-067: row-level actions surface as INLINE ICON BUTTONS rather than
 * the previous kebab dropdown. Visible icons by state (UAT-2026-05-11
 * feedback: «иконки прямо в строке проще»):
 *
 *   scheduled  → Edit · Archive (if server flag allows)
 *   open       → Edit · Publish · Archive (if server flag allows)
 *   published  → Edit · Reopen (if canReopen) · Archive (if canArchive)
 *   archived   → Edit · Unarchive
 *
 * Edit is unconditional — every row state can have its date envelope /
 * label patched without a state transition. Other icons keep their
 * server-flag gates (`canReopen` from reopen-window math; `canArchive`
 * skips archived + reflects publish state).
 *
 * Edit opens the same dialog as «New period» but in `mode: 'edit'` —
 * pre-fills from the row's current envelope and submits to
 * `admin.updatePeriodManual` instead of `admin.createPeriodManual`.
 *
 * `period.publish` and `period.reopen` are existing head-procedures
 * (admin role is aliased to head, so they're callable here). Archive +
 * Unarchive are admin-procedures from 51-B. updatePeriodManual is the
 * new 67 surface.
 */
export function PeriodsTab() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  // Archive section is collapsed by default. The query stays disabled
  // until the user opens the section to keep the initial page load to
  // a single round-trip (the active bucket).
  const [showArchive, setShowArchive] = useState(false);

  // UFB-063: «New period» dialog state. Opens via header button; submits
  // to admin.createPeriodManual; on success invalidates the period
  // lists so the table reflects the new row without a full reload.
  const [showCreate, setShowCreate] = useState(false);

  // UFB-067: edit-mode dialog state. The same component handles both
  // create and edit; `editingRow` !== null means the dialog opens in
  // edit-mode prefilled from this row. Submitting calls
  // admin.updatePeriodManual; on success invalidates the lists and
  // closes the dialog.
  const [editingRow, setEditingRow] = useState<PeriodListItem | null>(null);

  // A27: delete confirmation state. When user clicks delete, we set this
  // to the row and show a confirmation dialog.
  const [deleteConfirm, setDeleteConfirm] = useState<PeriodListItem | null>(
    null,
  );

  // A3: text search over active periods (weekLabel + date range)
  const [search, setSearch] = useState("");

  const activeQuery = useQuery(
    trpc.admin.listPeriodsByState.queryOptions({ bucket: "active" }),
  );
  const archiveQuery = useQuery({
    ...trpc.admin.listPeriodsByState.queryOptions({ bucket: "archive" }),
    enabled: showArchive,
  });

  function invalidatePeriodLists() {
    void qc.invalidateQueries(trpc.admin.listPeriodsByState.pathFilter());
    invalidateAdmin(qc, trpc);
  }

  const publishMut = useMutation(
    trpc.period.publish.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period published");
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to publish period");
      },
    }),
  );

  const reopenMut = useMutation(
    trpc.period.reopen.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period reopened");
      },
      onError: (err) => {
        // The 51-B reopen-policy gate (master switch + window) surfaces
        // through `PeriodAccessError → BAD_REQUEST` here; the message
        // already explains *why* the reopen was rejected so we pipe it
        // through verbatim.
        toast.error(err.message ?? "Failed to reopen period");
      },
    }),
  );

  const archiveMut = useMutation(
    trpc.admin.archivePeriod.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period archived");
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to archive period");
      },
    }),
  );

  const unarchiveMut = useMutation(
    trpc.admin.unarchivePeriod.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period unarchived");
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to unarchive period");
      },
    }),
  );

  // UFB-063: «New period» mutation. Pipes the server error message
  // through verbatim so overlap conflicts (server emits the colliding
  // date range) surface in the toast unchanged.
  const createMut = useMutation(
    trpc.admin.createPeriodManual.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period created");
        setShowCreate(false);
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to create period");
      },
    }),
  );

  // UFB-067: «Edit period» mutation. Same error-pipe pattern as create —
  // the server-side overlap message identifies the conflicting row and
  // the not-found message names the missing id; both flow through to the
  // toast verbatim.
  const updateMut = useMutation(
    trpc.admin.updatePeriodManual.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period updated");
        setEditingRow(null);
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to update period");
      },
    }),
  );

  // A27: delete period mutation with confirmation guard.
  const deleteMut = useMutation(
    trpc.admin.deleteReport.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success("Period deleted");
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to delete period");
      },
    }),
  );

  const allActiveRows = useMemo(
    () => (activeQuery.data ?? []) as PeriodListItem[],
    [activeQuery.data],
  );
  const archiveRows = useMemo(
    () => (archiveQuery.data ?? []) as PeriodListItem[],
    [archiveQuery.data],
  );

  const activeRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return allActiveRows;
    return allActiveRows.filter((row) =>
      [row.weekLabel, formatPeriodRange(row.periodStart, row.periodEnd)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [allActiveRows, search]);

  return (
    <div className="space-y-6">
      <TabHeader
        title="Periods"
        description="Reporting periods grouped by lifecycle state."
        count={`${allActiveRows.length} active`}
        search={
          <TabSearch
            value={search}
            onChange={setSearch}
            placeholder="Search periods…"
            testId="periods-search"
            ariaLabel="Search periods"
          />
        }
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            aria-label="New period"
            data-testid="periods-new-button"
          >
            <PlusIcon />
            New period
          </button>
        }
      />

      {/* ---- Active section ----------------------------------------- */}
      <section aria-labelledby="periods-active-heading" className="space-y-3">
        <header className="flex items-baseline justify-between">
          <h3
            id="periods-active-heading"
            className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]"
          >
            Active
          </h3>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            scheduled · open · published
          </span>
        </header>

        {activeQuery.isLoading ? (
          <div
            className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]"
            data-testid="periods-active-loading"
          >
            Loading…
          </div>
        ) : activeRows.length === 0 ? (
          <div
            className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]"
            data-testid="periods-active-empty"
          >
            No active periods.
          </div>
        ) : (
          <PeriodTable
            testIdPrefix="active"
            rows={activeRows}
            onPublish={(row) => publishMut.mutate({ reportId: row.id })}
            onReopen={(row) => reopenMut.mutate({ reportId: row.id })}
            onArchive={(row) => archiveMut.mutate({ periodId: row.id })}
            onUnarchive={(row) => unarchiveMut.mutate({ periodId: row.id })}
            onDelete={(row) => setDeleteConfirm(row)}
            onEdit={(row) => setEditingRow(row)}
          />
        )}
      </section>

      {/* ---- Archive section ---------------------------------------- */}
      <section aria-labelledby="periods-archive-heading" className="space-y-3">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowArchive((prev) => !prev)}
            className="flex items-center gap-2 text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-starbucks-accent)]"
            aria-expanded={showArchive}
            aria-controls="periods-archive-body"
            data-testid="periods-archive-toggle"
          >
            <Chevron expanded={showArchive} />
            <span id="periods-archive-heading">Archive</span>
          </button>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            archived
          </span>
        </header>

        {showArchive && (
          <div id="periods-archive-body" data-testid="periods-archive-body">
            {archiveQuery.isLoading ? (
              <div
                className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]"
                data-testid="periods-archive-loading"
              >
                Loading archive…
              </div>
            ) : archiveRows.length === 0 ? (
              <div
                className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]"
                data-testid="periods-archive-empty"
              >
                No archived periods.
              </div>
            ) : (
              <PeriodTable
                testIdPrefix="archive"
                rows={archiveRows}
                onPublish={(row) => publishMut.mutate({ reportId: row.id })}
                onReopen={(row) => reopenMut.mutate({ reportId: row.id })}
                onArchive={(row) => archiveMut.mutate({ periodId: row.id })}
                onUnarchive={(row) => unarchiveMut.mutate({ periodId: row.id })}
                onDelete={(row) => setDeleteConfirm(row)}
                onEdit={(row) => setEditingRow(row)}
              />
            )}
          </div>
        )}
      </section>

      {/* UFB-063: «New period» creation dialog ----------------------- */}
      {showCreate && (
        <CreatePeriodDialog
          mode="create"
          onCancel={() => setShowCreate(false)}
          onSubmit={(values) =>
            // Create-mode never emits `null` for weekLabel; narrow the
            // dialog's union back to the create-schema's `string | undefined`
            // expectation. The dialog guarantees this — but TS can't see
            // through the mode discriminator.
            createMut.mutate({
              periodStart: values.periodStart,
              periodEnd: values.periodEnd,
              deadline: values.deadline,
              weekLabel: values.weekLabel ?? undefined,
            })
          }
          isPending={createMut.isPending}
        />
      )}

      {/* UFB-067: «Edit period» dialog — same component, edit mode --- */}
      {editingRow && (
        <CreatePeriodDialog
          mode="edit"
          initialValues={editingRow}
          onCancel={() => setEditingRow(null)}
          onSubmit={(values) =>
            updateMut.mutate({
              reportId: editingRow.id,
              ...values,
            })
          }
          isPending={updateMut.isPending}
        />
      )}

      {/* A27: Delete confirmation dialog */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={() => setDeleteConfirm(null)}
          role="presentation"
          data-testid="periods-delete-dialog"
        >
          <div
            className="animate-scale-in mx-4 w-full max-w-sm rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Delete period confirmation"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              Delete period?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              This will permanently delete the period and all draft sections.
              This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteMut.isPending}
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteMut.mutate({ reportId: deleteConfirm.id });
                  setDeleteConfirm(null);
                }}
                disabled={deleteMut.isPending}
                className="btn-press rounded-[var(--radius-pill)] bg-[#991b1b] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7f1d1d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------

type PeriodTableProps = {
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
};

function PeriodTable({
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
  return (
    <tr
      data-testid={`periods-${testIdPrefix}-row-${row.id}`}
      data-period-state={row.periodState}
      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]"
    >
      <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
        {formatPeriodRange(row.periodStart, row.periodEnd)}
      </td>
      <td className="px-4 py-3">
        {row.periodStatus !== "reopened" && (
          <StateBadge state={row.periodState} />
        )}
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
          onClick={() => {}}
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

/**
 * UFB-067: shared icon-button shell. Centralises the 32×32 sizing, hover
 * state, and a11y labelling so the individual `ActionIconRow` icons stay
 * declarative.
 */
function IconButton({
  testId,
  label,
  onClick,
  icon,
  tone,
  disabled,
}: {
  readonly testId: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly tone?: "danger";
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={`btn-press inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : `hover:border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] ${
              tone === "danger"
                ? "text-[#991b1b] hover:text-[#7f1d1d]"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-starbucks-accent)]"
            }`
      }`}
    >
      {icon}
    </button>
  );
}

function Chevron({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// UFB-067: per-action icons used by the inline ActionIconRow. Each icon
// is a 16×16 stroke-currentColor SVG that the IconButton shell paints in
// the appropriate tone (muted by default, danger red for Archive). Paths
// follow the same lucide-style stroke conventions used elsewhere in the
// admin tabs so the visual language stays consistent.

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function PublishIcon() {
  // Paper-airplane / "send" silhouette.
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ReopenIcon() {
  // Rotate-counter-clockwise / refresh arrow.
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function UnarchiveIcon() {
  // Archive-restore: archive box with an upward arrow on top.
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <polyline points="9 14 12 11 15 14" />
      <line x1="12" y1="11" x2="12" y2="18" />
    </svg>
  );
}

function DeleteIcon() {
  // Trash icon for period deletion.
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ---------------------------------------------------------------------
// UFB-063: CreatePeriodDialog — admin «New period» modal.
// ---------------------------------------------------------------------

/**
 * Compute the next Monday after `from` (inclusive: if `from` is already
 * Monday, return `from` at 00:00 UTC). Used as the sensible default
 * pre-fill so the typical admin click → submit flow lands on a clean
 * week boundary that matches the cron's "next Monday" anchoring.
 */
function nextMonday(from: Date): string {
  const d = new Date(from.getTime());
  // getUTCDay: 0=Sun, 1=Mon..6=Sat. For Sun add 1 day; for any other
  // weekday add (8 - day) % 7 days. For Monday this evaluates to 0 →
  // returns `from` unchanged.
  const day = d.getUTCDay();
  const offset = day === 0 ? 1 : (8 - day) % 7;
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(0, 0, 0, 0);
  // Render as `YYYY-MM-DD` for the <input type="date"> value.
  return d.toISOString().slice(0, 10);
}

type CreatePeriodValues = {
  periodStart: Date;
  // UFB-067: nullable in edit-mode so the dialog can clear an existing
  // weekLabel via explicit `null`. Create-mode submitters never pass
  // `null` here (empty input → undefined / omit).
  periodEnd?: Date;
  deadline?: Date;
  weekLabel?: string | null;
};

/**
 * UFB-067: render a UTC Date as the `YYYY-MM-DD` value that
 * `<input type="date">` expects. Used both by the next-Monday default
 * and by the edit-mode prefill of an existing row's envelope. The slice
 * matches the existing create-path `${periodStart}T00:00:00.000Z` round-trip
 * so a no-op edit round-trips without spurious diff.
 */
function dateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * UFB-067: render a UTC Date as the `YYYY-MM-DDTHH:MM` value that
 * `<input type="datetime-local">` expects. Matches the inverse of the
 * existing `new Date(deadline)` parse in handleSubmit — both sides treat
 * the dialog's value as a wall-clock-in-UTC string. The existing
 * create-path comment acknowledges the timezone-shaped edge but keeps
 * the round-trip stable for the typical European admin case.
 */
function dateTimeInputValue(d: Date): string {
  return d.toISOString().slice(0, 16);
}

function CreatePeriodDialog({
  mode,
  initialValues,
  onCancel,
  onSubmit,
  isPending,
}: {
  /**
   * UFB-067: `mode === 'create'` opens the dialog as «New period» with
   * a next-Monday default; `mode === 'edit'` opens it as «Edit period»
   * prefilled from `initialValues` (the row being edited).
   */
  readonly mode: "create" | "edit";
  readonly initialValues?: PeriodListItem;
  readonly onCancel: () => void;
  readonly onSubmit: (values: CreatePeriodValues) => void;
  readonly isPending: boolean;
}) {
  const isEdit = mode === "edit" && initialValues !== undefined;

  // Initialise from the row in edit-mode; from nextMonday() otherwise.
  // The lazy-init form (`useState(() => …)`) keeps both branches cheap.
  const [periodStart, setPeriodStart] = useState(() =>
    isEdit ? dateInputValue(initialValues.periodStart) : nextMonday(new Date()),
  );
  const [periodEnd, setPeriodEnd] = useState(() =>
    isEdit ? dateInputValue(initialValues.periodEnd) : "",
  );
  const [deadline, setDeadline] = useState(() =>
    isEdit ? dateTimeInputValue(initialValues.deadline) : "",
  );
  const [weekLabel, setWeekLabel] = useState(
    isEdit ? (initialValues?.weekLabel ?? "") : "",
  );

  // Esc-to-close + click-outside (matches the groups-tab dialog pattern).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  function handleSubmit() {
    if (!periodStart) return;
    const startDate = new Date(`${periodStart}T00:00:00.000Z`);
    const endDate = periodEnd
      ? new Date(`${periodEnd}T23:59:59.999Z`)
      : undefined;
    const deadlineDate = deadline ? new Date(deadline) : undefined;

    // UFB-067: weekLabel clear semantics differ by mode.
    // - create: empty → `undefined` (omit from payload).
    // - edit:   empty → `null` (explicit clear of an existing label).
    let weekLabelValue: string | null | undefined;
    const trimmed = weekLabel.trim();
    if (trimmed === "") {
      weekLabelValue = isEdit ? null : undefined;
    } else {
      weekLabelValue = trimmed;
    }

    onSubmit({
      periodStart: startDate,
      periodEnd: endDate,
      deadline: deadlineDate,
      weekLabel: weekLabelValue,
    });
  }

  // A6b: deadline range validation.
  // Deadline must fall within [periodStart, periodEnd] when both are set.
  const deadlineError: string | null = (() => {
    if (!deadline) return null;
    const dl = new Date(deadline);
    if (periodStart) {
      const start = new Date(`${periodStart}T00:00:00.000Z`);
      if (dl < start) return "Deadline cannot be before period start.";
    }
    if (periodEnd) {
      const end = new Date(`${periodEnd}T23:59:59.999Z`);
      if (dl > end) return "Deadline cannot be after period end.";
    }
    return null;
  })();

  const canSubmit = periodStart !== "" && !isPending && !deadlineError;
  const title = isEdit ? "Edit period" : "New period";
  const description = isEdit
    ? "Adjust the date envelope or label for this reporting period."
    : "Mints a reporting period without waiting for the daily auto-creator. End date and deadline default from AppSettings when left blank.";
  const submitCopy = isEdit
    ? isPending
      ? "Saving…"
      : "Save"
    : isPending
      ? "Creating…"
      : "Create";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
      data-testid="periods-create-dialog"
      data-dialog-mode={mode}
    >
      <div
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {title}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="period-start"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Period start <span className="text-[#991b1b]">*</span>
            </label>
            <input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
              data-testid="periods-create-start"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="period-end"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Period end{" "}
              <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
                (optional)
              </span>
            </label>
            <input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              data-testid="periods-create-end"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="period-deadline"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Deadline{" "}
              <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
                (optional)
              </span>
            </label>
            <input
              id="period-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              data-testid="periods-create-deadline"
              className={`w-full rounded-[var(--radius-sm)] border px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] ${deadlineError ? "border-red-400 focus:border-red-400 bg-red-50" : "border-[var(--color-border)] focus:border-[var(--color-starbucks-accent)] bg-white"}`}
            />
            {deadlineError && (
              <p
                data-testid="periods-deadline-error"
                className="mt-1 text-xs text-red-600"
              >
                {deadlineError}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="period-label"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Period label{" "}
              <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
                (optional)
              </span>
            </label>
            <input
              id="period-label"
              type="text"
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
              maxLength={64}
              placeholder="e.g. Sprint 12 catch-up"
              data-testid="periods-create-label"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            data-testid="periods-create-cancel"
            className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="periods-create-submit"
            className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitCopy}
          </button>
        </div>
      </div>
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
