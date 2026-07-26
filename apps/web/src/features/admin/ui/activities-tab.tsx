"use client";

import type { ProjectActivity } from "@customreport/shared";
import { useMemo } from "react";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import { PlusIcon } from "../../../shared/ui/icons";
import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import type { ActivityFormData } from "../model/activity-form";
import type { MockGroup, MockProduct, MockUser } from "../model/admin-types";
import { ActivitiesTable } from "./activities-table";
import { ActivityEditDialog } from "./activity-edit-dialog";
import { AdminQueryIssue } from "./admin-query-issue";
import { AdminTabSkeleton } from "./admin-skeleton";
import { useActivitiesTabState } from "./use-activities-tab-state";

interface ActivitiesTabProps {
  readonly groups: readonly MockGroup[];
  readonly users: readonly MockUser[];
  readonly products: readonly MockProduct[];
}

// Pickers offer active rows only; the name lookup reads the full group list so
// an activity still resolves to a name after its group is archived.
function useActivityPickerData(
  groups: readonly MockGroup[],
  products: readonly MockProduct[],
) {
  return {
    activeGroups: useMemo(
      () => groups.filter((group) => !group.archived),
      [groups],
    ),
    activeProducts: useMemo(
      () => products.filter((product) => product.status === "active"),
      [products],
    ),
    groupNameById: useMemo(
      () => new Map(groups.map((group) => [group.id, group.name])),
      [groups],
    ),
  };
}

export function ActivitiesTab({ groups, users, products }: ActivitiesTabProps) {
  const { activeGroups, activeProducts, groupNameById } = useActivityPickerData(
    groups,
    products,
  );
  const state = useActivitiesTabState({ groups: activeGroups });

  if (state.isError) {
    return (
      <AdminQueryIssue
        description="Project activities could not be loaded."
        onRetry={state.retry}
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        <ActivitiesTabHeader
          activeCount={state.activeActivities.length}
          archivedCount={state.archivedActivities.length}
          localSearch={state.localSearch}
          onLocalSearchChange={state.setLocalSearch}
          onAdd={state.openAdd}
        />

        {state.isLoading ? (
          <AdminTabSkeleton variant="table" />
        ) : (
          <ActivitiesTable
            activeActivities={state.activeActivities}
            archivedActivities={state.archivedActivities}
            groupNameById={groupNameById}
            users={users}
            expandedId={state.expandedId}
            onToggleExpand={state.toggleExpand}
            onEdit={state.openEdit}
            onArchive={state.setPendingArchive}
            onRestore={state.handleRestore}
            isArchiving={state.isArchiving}
          />
        )}
      </div>

      <ActivitiesTabDialogs
        {...state}
        groups={activeGroups}
        products={activeProducts}
      />
    </>
  );
}

interface ActivitiesTabDialogsProps {
  readonly showDialog: boolean;
  readonly editingActivity: ProjectActivity | null;
  readonly form: ActivityFormData;
  readonly setForm: (form: ActivityFormData) => void;
  readonly groups: readonly MockGroup[];
  readonly products: readonly MockProduct[];
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly handleSave: () => void;
  readonly closeDialog: () => void;
  readonly pendingArchive: ProjectActivity | null;
  readonly setPendingArchive: (activity: ProjectActivity | null) => void;
  readonly confirmArchive: () => void;
}

function ActivitiesTabDialogs({
  showDialog,
  editingActivity,
  form,
  setForm,
  groups,
  products,
  canSave,
  isSaving,
  handleSave,
  closeDialog,
  pendingArchive,
  setPendingArchive,
  confirmArchive,
}: ActivitiesTabDialogsProps) {
  return (
    <>
      {showDialog && (
        <ActivityEditDialog
          editingActivity={editingActivity}
          form={form}
          onFormChange={setForm}
          groups={groups}
          products={products}
          canSave={canSave}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={closeDialog}
        />
      )}

      <ConfirmDeleteDialog
        open={pendingArchive !== null}
        title="Archive activity?"
        preview={pendingArchive?.name ?? ""}
        subtitle="Lead attachments and reported statuses are preserved."
        consequence="The activity will disappear from lead forms until restored."
        confirmLabel="Archive"
        reversible
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </>
  );
}

interface ActivitiesTabHeaderProps {
  readonly activeCount: number;
  readonly archivedCount: number;
  readonly localSearch: string;
  readonly onLocalSearchChange: (next: string) => void;
  readonly onAdd: () => void;
}

function ActivitiesTabHeader({
  activeCount,
  archivedCount,
  localSearch,
  onLocalSearchChange,
  onAdd,
}: ActivitiesTabHeaderProps) {
  return (
    <TabHeader
      title="Activities"
      description="Stage-less reporting units beside products. Attach the leads who report on each one."
      count={`${activeCount} active · ${archivedCount} archived`}
      search={
        <TabSearch
          value={localSearch}
          onChange={onLocalSearchChange}
          placeholder="Filter activities…"
          testId="activities-local-search"
          ariaLabel="Filter activities by name"
        />
      }
      actions={
        <button
          type="button"
          onClick={onAdd}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
          aria-label="Add new activity"
        >
          <PlusIcon />
          Add Activity
        </button>
      }
    />
  );
}
