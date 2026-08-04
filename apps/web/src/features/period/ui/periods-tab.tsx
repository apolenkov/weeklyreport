"use client";

import type { PeriodListItem } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatPeriodLabel, formatPeriodRange } from "../../../lib/format-date";
import { useTRPC } from "../../../lib/trpc-context";
import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import { usePeriodMutations } from "../model/use-period-mutations";
import { PeriodsActiveSection } from "./periods-active-section";
import { PeriodsArchiveSection } from "./periods-archive-section";
import { PeriodsTabDialogs } from "./periods-tab-dialogs";
import { PlusIcon } from "./periods-tab-icons";

type PeriodMutations = ReturnType<typeof usePeriodMutations>;

interface PeriodDialogState {
  readonly showCreate: boolean;
  readonly editingRow: PeriodListItem | null;
  readonly deleteConfirm: PeriodListItem | null;
  readonly openCreate: () => void;
  readonly closeCreate: () => void;
  readonly openEdit: (row: PeriodListItem) => void;
  readonly closeEdit: () => void;
  readonly requestDelete: (row: PeriodListItem) => void;
  readonly closeDelete: () => void;
}

// Returns a capture callback: call it while opening a dialog to remember the
// element that opened it, so focus can return there once `openState` clears.
function useRestoreFocusOnClose(openState: unknown) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!openState && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [openState]);

  return () => {
    triggerRef.current = document.activeElement as HTMLElement;
  };
}

function usePeriodDialogState(): PeriodDialogState {
  const [showCreate, setShowCreate] = useState(false);
  const [editingRow, setEditingRow] = useState<PeriodListItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PeriodListItem | null>(
    null,
  );

  const captureCreateTrigger = useRestoreFocusOnClose(showCreate);
  const captureEditTrigger = useRestoreFocusOnClose(editingRow);

  return {
    showCreate,
    editingRow,
    deleteConfirm,
    openCreate: () => {
      captureCreateTrigger();
      setShowCreate(true);
    },
    closeCreate: () => setShowCreate(false),
    openEdit: (row) => {
      captureEditTrigger();
      setEditingRow(row);
    },
    closeEdit: () => setEditingRow(null),
    requestDelete: setDeleteConfirm,
    closeDelete: () => setDeleteConfirm(null),
  };
}

function filterPeriodRows(
  rows: readonly PeriodListItem[],
  search: string,
): readonly PeriodListItem[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [
      row.weekLabel,
      formatPeriodLabel(row.periodStart, row.periodEnd),
      formatPeriodRange(row.periodStart, row.periodEnd),
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

function usePeriodRows(showArchive: boolean, search: string) {
  const trpc = useTRPC();

  const activeQuery = useQuery(
    trpc.admin.listPeriodsByState.queryOptions({ bucket: "active" }),
  );
  // Archive section is collapsed by default. The query stays disabled until
  // the user opens the section (single round-trip for the active bucket).
  const archiveQuery = useQuery({
    ...trpc.admin.listPeriodsByState.queryOptions({ bucket: "archive" }),
    enabled: showArchive,
  });

  const allActiveRows = useMemo(
    () => activeQuery.data ?? [],
    [activeQuery.data],
  );
  const archiveRows = useMemo(
    () => archiveQuery.data ?? [],
    [archiveQuery.data],
  );
  const activeRows = useMemo(
    () => filterPeriodRows(allActiveRows, search),
    [allActiveRows, search],
  );
  const filteredArchiveRows = useMemo(
    () => filterPeriodRows(archiveRows, search),
    [archiveRows, search],
  );

  return {
    activeQuery,
    archiveQuery,
    allActiveRows,
    activeRows,
    filteredArchiveRows,
  };
}

function buildRowActions(
  mutations: PeriodMutations,
  dialogs: PeriodDialogState,
) {
  return {
    onPublish: (row: PeriodListItem) =>
      mutations.publishMut.mutate({ reportId: row.id }),
    onReopen: (row: PeriodListItem) =>
      mutations.reopenMut.mutate({ reportId: row.id }),
    onArchive: (row: PeriodListItem) =>
      mutations.archiveMut.mutate({ periodId: row.id }),
    onUnarchive: (row: PeriodListItem) =>
      mutations.unarchiveMut.mutate({ periodId: row.id }),
    onDelete: dialogs.requestDelete,
    onEdit: dialogs.openEdit,
  };
}

function PeriodsTabHeader({
  activeCount,
  search,
  onSearchChange,
  onNewPeriod,
}: {
  readonly activeCount: number;
  readonly search: string;
  readonly onSearchChange: (next: string) => void;
  readonly onNewPeriod: () => void;
}) {
  return (
    <TabHeader
      title="Periods"
      description="Reporting periods grouped by lifecycle state."
      count={`${activeCount} active`}
      search={
        <TabSearch
          value={search}
          onChange={onSearchChange}
          placeholder="Search periods…"
          testId="periods-search"
          ariaLabel="Search periods"
        />
      }
      actions={
        <button
          type="button"
          onClick={onNewPeriod}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)]"
          aria-label="New period"
          data-testid="periods-new-button"
        >
          <PlusIcon />
          New period
        </button>
      }
    />
  );
}

function PeriodsTabDialogsSlot({
  dialogs,
  mutations,
}: {
  readonly dialogs: PeriodDialogState;
  readonly mutations: PeriodMutations;
}) {
  const { createMut, updateMut, deleteMut } = mutations;
  const { editingRow, deleteConfirm } = dialogs;

  return (
    <PeriodsTabDialogs
      showCreate={dialogs.showCreate}
      onCancelCreate={dialogs.closeCreate}
      // Create mode never emits `null` for weekLabel, but TS cannot see that
      // through the dialog's mode discriminator — narrow it back here.
      onSubmitCreate={(values) =>
        createMut.mutate({
          periodStart: values.periodStart,
          periodEnd: values.periodEnd,
          deadline: values.deadline,
          weekLabel: values.weekLabel ?? undefined,
        })
      }
      createIsPending={createMut.isPending}
      editingRow={editingRow}
      onCancelEdit={dialogs.closeEdit}
      onSubmitEdit={(values) =>
        editingRow && updateMut.mutate({ reportId: editingRow.id, ...values })
      }
      editIsPending={updateMut.isPending}
      deleteConfirm={deleteConfirm}
      deleteIsPending={deleteMut.isPending}
      onCloseDelete={dialogs.closeDelete}
      onConfirmDelete={() =>
        deleteConfirm && deleteMut.mutate({ reportId: deleteConfirm.id })
      }
    />
  );
}

export function PeriodsTab() {
  const [showArchive, setShowArchive] = useState(false);
  const [search, setSearch] = useState("");
  const dialogs = usePeriodDialogState();

  const {
    activeQuery,
    archiveQuery,
    allActiveRows,
    activeRows,
    filteredArchiveRows,
  } = usePeriodRows(showArchive, search);

  const mutations = usePeriodMutations({
    onCreateSuccess: dialogs.closeCreate,
    onEditSuccess: dialogs.closeEdit,
    onDeleteSuccess: dialogs.closeDelete,
  });

  const rowActions = buildRowActions(mutations, dialogs);

  return (
    <div className="space-y-6">
      <PeriodsTabHeader
        activeCount={allActiveRows.length}
        search={search}
        onSearchChange={setSearch}
        onNewPeriod={dialogs.openCreate}
      />

      <PeriodsActiveSection
        isLoading={activeQuery.isLoading}
        isError={activeQuery.isError}
        rows={activeRows}
        {...rowActions}
      />

      <PeriodsArchiveSection
        expanded={showArchive}
        onToggle={() => setShowArchive((prev) => !prev)}
        isLoading={archiveQuery.isLoading}
        isError={archiveQuery.isError}
        rows={filteredArchiveRows}
        {...rowActions}
      />

      <PeriodsTabDialogsSlot dialogs={dialogs} mutations={mutations} />
    </div>
  );
}
