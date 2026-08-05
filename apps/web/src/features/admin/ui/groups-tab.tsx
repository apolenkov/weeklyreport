"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { ConfirmDeleteDialog } from "../../../shared/ui/dialogs/confirm-delete-dialog";
import { PlusIcon } from "../../../shared/ui/icons/action-icons";
import {
  TabFilter,
  TabHeader,
  TabSearch,
} from "../../../shared/ui/tabs/tab-header";
import { toReportingGroupInput } from "../model/admin";
import type {
  AdminGroupView,
  AdminProductView,
  AdminUserView,
} from "../model/admin-types";
import {
  EMPTY_GROUP_FORM,
  formFromGroup,
  type GroupFormData,
} from "../model/group-form";
import { GroupEditDialog } from "./group-edit-dialog";
import { GroupsTable } from "./groups-table";

const ARCHIVE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;
type ArchiveFilterValue = (typeof ARCHIVE_OPTIONS)[number]["value"];

interface GroupsTabProps {
  readonly groups: AdminGroupView[];
  readonly users: AdminUserView[];
  // Product roster for the «Products attached» section inside the edit
  // dialog. Required: a missing roster must fail the build, never render as
  // a valid-looking "no products" state.
  readonly products: AdminProductView[];
}

// only head/admin users may lead a group. Filter the candidate
// dropdown so leads/viewers can't be picked.
function useGroupLeadCandidates(users: AdminUserView[]) {
  const headCandidates = useMemo(
    () => users.filter((u) => u.role === "head" || u.role === "admin"),
    [users],
  );
  const headById = useMemo(
    () => new Map(headCandidates.map((u) => [u.id, u])),
    [headCandidates],
  );
  return { headCandidates, headById };
}

function useGroupFilters(groups: AdminGroupView[]) {
  const [search, setSearch] = useState("");
  const [archiveFilter, setArchiveFilter] =
    useState<ArchiveFilterValue>("active");

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return groups.filter((group) => {
      if (archiveFilter === "active" && group.archived) return false;
      if (archiveFilter === "archived" && !group.archived) return false;
      if (!needle) return true;
      return [group.name, group.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [groups, search, archiveFilter]);

  return {
    search,
    setSearch,
    archiveFilter,
    setArchiveFilter,
    filteredGroups,
  };
}

function useGroupDialogState() {
  const [editingGroup, setEditingGroup] = useState<AdminGroupView | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminGroupView | null>(
    null,
  );
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<GroupFormData>(EMPTY_GROUP_FORM);

  // Add and Edit differ only by the group the form is seeded from.
  function openDialog(group: AdminGroupView | null) {
    setEditingGroup(group);
    setForm(group === null ? EMPTY_GROUP_FORM : formFromGroup(group));
    setShowDialog(true);
  }

  return {
    editingGroup,
    archiveTarget,
    setArchiveTarget,
    showDialog,
    closeDialog: () => setShowDialog(false),
    form,
    setForm,
    openDialog,
  };
}

type GroupDialogState = ReturnType<typeof useGroupDialogState>;

function useGroupCommands(dialog: GroupDialogState) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const saveGroupMut = useMutation(
    trpc.admin.saveReportingGroup.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Group saved");
        dialog.closeDialog();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const archiveGroupMut = useMutation(
    trpc.admin.archiveReportingGroup.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Group archived");
        dialog.setArchiveTarget(null);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const { form, editingGroup, archiveTarget } = dialog;

  return {
    isSaving: saveGroupMut.isPending,
    save: () =>
      saveGroupMut.mutate(
        toReportingGroupInput(
          {
            ...form,
            headUserId: form.headUserId === "" ? null : form.headUserId,
          },
          editingGroup?.id,
        ),
      ),
    archive: () => {
      if (!archiveTarget) return;
      archiveGroupMut.mutate({ groupId: archiveTarget.id });
      // Close immediately (same pattern as users/reminders): the confirm dialog
      // has no pending state, so leaving it open would allow a double-fire.
      dialog.setArchiveTarget(null);
    },
  };
}

function useGroupsTab(groups: AdminGroupView[], users: AdminUserView[]) {
  const { headCandidates, headById } = useGroupLeadCandidates(users);
  const filters = useGroupFilters(groups);
  const dialog = useGroupDialogState();
  const commands = useGroupCommands(dialog);

  return {
    headCandidates,
    headById,
    filters,
    dialog,
    commands,
    activeGroupCount: groups.filter((group) => !group.archived).length,
  };
}

type GroupsTabModel = ReturnType<typeof useGroupsTab>;

// Admin UI uses "Group/Groups" wording; the Prisma model
// (ReportingGroup) and test ids keep the original naming.
function GroupsTabHeader({
  tab,
  totalCount,
}: {
  readonly tab: GroupsTabModel;
  readonly totalCount: number;
}) {
  const { filters } = tab;
  return (
    <TabHeader
      title="Groups"
      description={`Reporting groups (organisational units). ${tab.activeGroupCount} active.`}
      count={`${totalCount} groups`}
      search={
        <>
          <TabFilter
            value={filters.archiveFilter}
            onChange={(v) => filters.setArchiveFilter(v as ArchiveFilterValue)}
            options={ARCHIVE_OPTIONS}
            testId="groups-archive-filter"
            ariaLabel="Filter by archive status"
          />
          <TabSearch
            value={filters.search}
            onChange={filters.setSearch}
            placeholder="Search groups…"
            testId="groups-search"
            ariaLabel="Search groups"
          />
        </>
      }
      actions={
        <button
          type="button"
          onClick={() => tab.dialog.openDialog(null)}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)]"
          aria-label="Add group"
        >
          <PlusIcon />
          Add Group
        </button>
      }
    />
  );
}

export function GroupsTab({ groups, users, products }: GroupsTabProps) {
  const tab = useGroupsTab(groups, users);
  const { dialog, commands, filters } = tab;

  return (
    <>
      <div className="space-y-4" data-testid="groups-tab">
        <GroupsTabHeader tab={tab} totalCount={groups.length} />

        <GroupsTable
          groups={filters.filteredGroups}
          headById={tab.headById}
          activeGroupCount={tab.activeGroupCount}
          onEdit={dialog.openDialog}
          onArchive={dialog.setArchiveTarget}
        />

        {filters.filteredGroups.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            No groups match the search.
          </div>
        )}
      </div>

      {dialog.showDialog && (
        <GroupEditDialog
          editingGroup={dialog.editingGroup}
          form={dialog.form}
          onFormChange={dialog.setForm}
          headCandidates={tab.headCandidates}
          products={products}
          canSave={dialog.form.name.trim().length > 0 && !commands.isSaving}
          isSaving={commands.isSaving}
          onSave={commands.save}
          onClose={dialog.closeDialog}
        />
      )}

      <ConfirmDeleteDialog
        open={dialog.archiveTarget !== null}
        title="Archive Group?"
        preview={dialog.archiveTarget ? dialog.archiveTarget.name : ""}
        subtitle="Existing users keep the group, but new users cannot select it."
        reversible
        confirmLabel="Archive"
        onConfirm={commands.archive}
        onCancel={() => dialog.setArchiveTarget(null)}
      />
    </>
  );
}
