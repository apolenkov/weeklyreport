"use client";

import type { PeriodListItem } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  formatPeriodLabel,
  formatPeriodRange,
} from "../../../shared/lib/format/format-date";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { TabHeader, TabSearch } from "../../../shared/ui/tabs/tab-header";
import { usePeriodMutations } from "../model/use-period-mutations";
import {
  type PeriodDialogState,
  usePeriodDialogState,
} from "./dialogs/use-period-dialog-state";
import { PeriodsActiveSection } from "./periods-active-section";
import { PeriodsArchiveSection } from "./periods-archive-section";
import { PeriodsTabDialogs } from "./periods-tab-dialogs";
import { PlusIcon } from "./periods-tab-icons";

type PeriodMutations = ReturnType<typeof usePeriodMutations>;

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
    onReopen: dialogs.requestReopen,
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
  const { editingRow, reopenConfirm, deleteConfirm } = dialogs;

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
      reopenConfirm={reopenConfirm}
      reopenIsPending={mutations.reopenMut.isPending}
      onCloseReopen={dialogs.closeReopen}
      onConfirmReopen={() =>
        reopenConfirm &&
        mutations.reopenMut.mutate({ reportId: reopenConfirm.id })
      }
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
    onReopenSuccess: dialogs.closeReopen,
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
