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

export function PeriodsTab() {
  const trpc = useTRPC();

  // Archive section is collapsed by default. The query stays disabled until
  // the user opens the section (single round-trip for the active bucket).
  const [showArchive, setShowArchive] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editingRow, setEditingRow] = useState<PeriodListItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PeriodListItem | null>(
    null,
  );

  // Save the trigger element before opening create/edit; restore on close.
  const dialogTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!showCreate && dialogTriggerRef.current) {
      dialogTriggerRef.current.focus();
      dialogTriggerRef.current = null;
    }
  }, [showCreate]);

  useEffect(() => {
    if (!editingRow && dialogTriggerRef.current) {
      dialogTriggerRef.current.focus();
      dialogTriggerRef.current = null;
    }
  }, [editingRow]);

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
    () => activeQuery.data ?? [],
    [activeQuery.data],
  );
  const archiveRows = useMemo(
    () => archiveQuery.data ?? [],
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

  const rowActions = {
    onPublish: (row: PeriodListItem) => publishMut.mutate({ reportId: row.id }),
    onReopen: (row: PeriodListItem) => reopenMut.mutate({ reportId: row.id }),
    onArchive: (row: PeriodListItem) => archiveMut.mutate({ periodId: row.id }),
    onUnarchive: (row: PeriodListItem) =>
      unarchiveMut.mutate({ periodId: row.id }),
    onDelete: (row: PeriodListItem) => setDeleteConfirm(row),
    onEdit: (row: PeriodListItem) => {
      dialogTriggerRef.current = document.activeElement as HTMLElement;
      setEditingRow(row);
    },
  };

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

      <PeriodsActiveSection
        isLoading={activeQuery.isLoading}
        rows={activeRows}
        {...rowActions}
      />

      <PeriodsArchiveSection
        expanded={showArchive}
        onToggle={() => setShowArchive((prev) => !prev)}
        isLoading={archiveQuery.isLoading}
        rows={archiveRows}
        {...rowActions}
      />

      <PeriodsTabDialogs
        showCreate={showCreate}
        onCancelCreate={() => setShowCreate(false)}
        onSubmitCreate={(values) =>
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
        createIsPending={createMut.isPending}
        editingRow={editingRow}
        onCancelEdit={() => setEditingRow(null)}
        onSubmitEdit={(values) =>
          editingRow &&
          updateMut.mutate({
            reportId: editingRow.id,
            ...values,
          })
        }
        editIsPending={updateMut.isPending}
        deleteConfirm={deleteConfirm}
        deleteIsPending={deleteMut.isPending}
        onCloseDelete={() => setDeleteConfirm(null)}
        onConfirmDelete={() =>
          deleteConfirm && deleteMut.mutate({ reportId: deleteConfirm.id })
        }
      />
    </div>
  );
}
