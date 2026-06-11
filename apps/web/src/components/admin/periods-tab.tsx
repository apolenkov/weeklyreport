"use client";

import type { PeriodListItem } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatPeriodLabel, formatPeriodRange } from "../../lib/format-date";
import { useTRPC } from "../../lib/trpc-context";
import { CreatePeriodDialog } from "./periods-tab-dialog";
import { Chevron, PlusIcon } from "./periods-tab-icons";
import { PeriodTable } from "./periods-tab-table";
import { TabHeader, TabSearch } from "./tab-header";
import { usePeriodMutations } from "./use-period-mutations";

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
 * the previous kebab dropdown. The row table, icon set, the create/edit
 * dialog, and the seven lifecycle mutations live in sibling modules
 * (periods-tab-table / periods-tab-icons / periods-tab-dialog /
 * use-period-mutations) extracted in the R3a-4 max-lines split.
 *
 * `period.publish` and `period.reopen` are existing head-procedures
 * (admin role is aliased to head, so they're callable here). Archive +
 * Unarchive are admin-procedures from 51-B. updatePeriodManual is the
 * new 67 surface.
 */
export function PeriodsTab() {
  const trpc = useTRPC();

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

  // A27: Esc-to-close for the delete confirmation dialog (matches the
  // create/edit dialog pattern below). Backdrop click and Cancel also close.
  useEffect(() => {
    if (!deleteConfirm) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setDeleteConfirm(null);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [deleteConfirm]);

  // A3: text search over active periods (weekLabel + date range)
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
                onEdit={(row) => {
                  dialogTriggerRef.current =
                    document.activeElement as HTMLElement;
                  setEditingRow(row);
                }}
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
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops propagation to the backdrop; not a user interaction, no keyboard equivalent applies */}
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
