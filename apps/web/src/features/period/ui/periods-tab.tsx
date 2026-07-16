"use client";

import type { PeriodListItem } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatPeriodLabel, formatPeriodRange } from "../../../lib/format-date";
import { useTRPC } from "../../../lib/trpc-context";
import { ConfirmationDialog } from "../../../shared/ui/confirmation-dialog";
import { TabHeader, TabSearch } from "../../admin";
import { usePeriodMutations } from "../model/use-period-mutations";
import { PeriodsArchiveSection } from "./periods-archive-section";
import { CreatePeriodDialog } from "./periods-tab-dialog";
import { PlusIcon } from "./periods-tab-icons";
import { PeriodTable } from "./periods-tab-table";

/**
 * Admin → Periods tab.
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
 * Row-level actions surface as inline icon buttons. The row table, icon
 * set, the create/edit dialog, and the seven lifecycle mutations live in
 * sibling modules (periods-tab-table / periods-tab-icons /
 * periods-tab-dialog / use-period-mutations).
 *
 * `period.publish` and `period.reopen` are head-procedures (admin role is
 * aliased to head, so they're callable here). Archive + Unarchive are
 * admin-procedures. updatePeriodManual backs manual edits.
 */
export function PeriodsTab() {
  const trpc = useTRPC();

  // Archive section is collapsed by default. The query stays disabled
  // until the user opens the section to keep the initial page load to
  // a single round-trip (the active bucket).
  const [showArchive, setShowArchive] = useState(false);

  // «New period» dialog state. Opens via header button; submits
  // to admin.createPeriodManual; on success invalidates the period
  // lists so the table reflects the new row without a full reload.
  const [showCreate, setShowCreate] = useState(false);

  // edit-mode dialog state. The same component handles both
  // create and edit; `editingRow` !== null means the dialog opens in
  // edit-mode prefilled from this row. Submitting calls
  // admin.updatePeriodManual; on success invalidates the lists and
  // closes the dialog.
  const [editingRow, setEditingRow] = useState<PeriodListItem | null>(null);

  // delete confirmation state. When user clicks delete, we set this
  // to the row and show a confirmation dialog.
  const [deleteConfirm, setDeleteConfirm] = useState<PeriodListItem | null>(
    null,
  );

  // admin-dialog-focus-management: save the trigger element before opening
  // either the create or edit dialog, then restore on close.
  const dialogTriggerRef = useRef<HTMLElement | null>(null);

  // Restore focus when create dialog closes (all close paths set showCreate→false).
  useEffect(() => {
    if (!showCreate && dialogTriggerRef.current) {
      dialogTriggerRef.current.focus();
      dialogTriggerRef.current = null;
    }
  }, [showCreate]);

  // Restore focus when edit dialog closes (all close paths set editingRow→null).
  useEffect(() => {
    if (!editingRow && dialogTriggerRef.current) {
      dialogTriggerRef.current.focus();
      dialogTriggerRef.current = null;
    }
  }, [editingRow]);

  // text search over active periods (weekLabel + date range)
  const [search, setSearch] = useState("");

  const activeQuery = useQuery(
    trpc.admin.listPeriodsByState.queryOptions({ bucket: "active" }),
  );
  const archiveQuery = useQuery({
    ...trpc.admin.listPeriodsByState.queryOptions({ bucket: "archive" }),
    enabled: showArchive,
  });

  const {
    publishMut,
    reopenMut,
    archiveMut,
    unarchiveMut,
    createMut,
    updateMut,
    deleteMut,
  } = usePeriodMutations({
    onCreateSuccess: () => setShowCreate(false),
    onEditSuccess: () => setEditingRow(null),
    onDeleteSuccess: () => setDeleteConfirm(null),
  });

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
      [
        row.weekLabel,
        formatPeriodLabel(row.periodStart, row.periodEnd),
        formatPeriodRange(row.periodStart, row.periodEnd),
      ]
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
            onClick={() => {
              dialogTriggerRef.current = document.activeElement as HTMLElement;
              setShowCreate(true);
            }}
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
            onEdit={(row) => {
              dialogTriggerRef.current = document.activeElement as HTMLElement;
              setEditingRow(row);
            }}
          />
        )}
      </section>

      {/* ---- Archive section ---------------------------------------- */}
      <PeriodsArchiveSection
        expanded={showArchive}
        onToggle={() => setShowArchive((prev) => !prev)}
        isLoading={archiveQuery.isLoading}
        rows={archiveRows}
        onPublish={(row) => publishMut.mutate({ reportId: row.id })}
        onReopen={(row) => reopenMut.mutate({ reportId: row.id })}
        onArchive={(row) => archiveMut.mutate({ periodId: row.id })}
        onUnarchive={(row) => unarchiveMut.mutate({ periodId: row.id })}
        onDelete={(row) => setDeleteConfirm(row)}
        onEdit={(row) => {
          dialogTriggerRef.current = document.activeElement as HTMLElement;
          setEditingRow(row);
        }}
      />

      {/* «New period» creation dialog ----------------------- */}
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

      {/* «Edit period» dialog — same component, edit mode --- */}
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

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <ConfirmationDialog
          open={true}
          title="Delete period?"
          description="This will permanently delete the period and all draft sections. This action cannot be undone."
          confirmLabel={deleteMut.isPending ? "Deleting…" : "Delete"}
          variant="delete"
          testId="periods-delete-dialog"
          isPending={deleteMut.isPending}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => deleteMut.mutate({ reportId: deleteConfirm.id })}
        />
      )}
    </div>
  );
}
