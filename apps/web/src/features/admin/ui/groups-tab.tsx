"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";
import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import { PlusIcon } from "../../../shared/ui/icons";
import { toReportingGroupInput } from "../model/admin";
import type { MockGroup, MockProduct, MockUser } from "../model/admin-types";
import {
  EMPTY_GROUP_FORM,
  formFromGroup,
  type GroupFormData,
} from "../model/group-form";
import { GroupEditDialog } from "./group-edit-dialog";
import { GroupsTable } from "./groups-table";
import { TabFilter, TabHeader, TabSearch } from "./tab-header";

// archive quick-filter — default "active" hides archived groups on load
const ARCHIVE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;
type ArchiveFilterValue = (typeof ARCHIVE_OPTIONS)[number]["value"];

interface GroupsTabProps {
  readonly groups: MockGroup[];
  readonly users: MockUser[];
  // product roster for the «Products attached» section inside the edit
  // dialog. Optional so callers that don't thread products through (e.g.
  // unit tests) keep compiling — the section short-circuits to an empty list.
  readonly products?: MockProduct[];
}

export function GroupsTab({ groups, users, products = [] }: GroupsTabProps) {
  // only head/admin users may lead a group. Filter the candidate
  // dropdown so leads/viewers can't be picked.
  const headCandidates = useMemo(
    () => users.filter((u) => u.role === "head" || u.role === "admin"),
    [users],
  );
  const headById = useMemo(
    () => new Map(headCandidates.map((u) => [u.id, u])),
    [headCandidates],
  );
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [editingGroup, setEditingGroup] = useState<MockGroup | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MockGroup | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<GroupFormData>(EMPTY_GROUP_FORM);
  const [search, setSearch] = useState("");
  // archive quick-filter (default "active" — hides archived groups on load)
  const [archiveFilter, setArchiveFilter] =
    useState<ArchiveFilterValue>("active");

  const saveGroupMut = useMutation(
    trpc.admin.saveReportingGroup.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Group saved");
        setShowDialog(false);
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
        setArchiveTarget(null);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  function openAdd() {
    setEditingGroup(null);
    setForm(EMPTY_GROUP_FORM);
    setShowDialog(true);
  }

  function openEdit(group: MockGroup) {
    setEditingGroup(group);
    setForm(formFromGroup(group));
    setShowDialog(true);
  }

  function handleSave() {
    saveGroupMut.mutate(
      toReportingGroupInput(
        {
          ...form,
          headUserId: form.headUserId === "" ? null : form.headUserId,
        },
        editingGroup?.id,
      ),
    );
  }

  function handleArchive() {
    if (!archiveTarget) return;
    archiveGroupMut.mutate({ groupId: archiveTarget.id });
    // Close immediately (same pattern as users/reminders): the confirm dialog
    // has no pending state, so leaving it open would allow a double-fire.
    setArchiveTarget(null);
  }

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

  const isSaving = saveGroupMut.isPending;
  const canSave = form.name.trim().length > 0 && !isSaving;
  const activeGroupCount = groups.filter((group) => !group.archived).length;

  return (
    <>
      <div className="space-y-4" data-testid="groups-tab">
        {/* Admin UI uses "Group/Groups" wording; the Prisma model
            (ReportingGroup) and test ids keep the original naming. */}
        <TabHeader
          title="Groups"
          description={`Reporting groups (organisational units). ${activeGroupCount} active.`}
          count={`${groups.length} groups`}
          search={
            <>
              <TabFilter
                value={archiveFilter}
                onChange={(v) => setArchiveFilter(v as ArchiveFilterValue)}
                options={ARCHIVE_OPTIONS}
                testId="groups-archive-filter"
                ariaLabel="Filter by archive status"
              />
              <TabSearch
                value={search}
                onChange={setSearch}
                placeholder="Search groups…"
                testId="groups-search"
                ariaLabel="Search groups"
              />
            </>
          }
          actions={
            <button
              type="button"
              onClick={openAdd}
              className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
              aria-label="Add group"
            >
              <PlusIcon />
              Add Group
            </button>
          }
        />

        <GroupsTable
          groups={filteredGroups}
          headById={headById}
          activeGroupCount={activeGroupCount}
          onEdit={openEdit}
          onArchive={setArchiveTarget}
        />

        {filteredGroups.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            No groups match the search.
          </div>
        )}
      </div>

      {showDialog && (
        <GroupEditDialog
          editingGroup={editingGroup}
          form={form}
          onFormChange={setForm}
          headCandidates={headCandidates}
          products={products}
          canSave={canSave}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => setShowDialog(false)}
        />
      )}

      <ConfirmDeleteDialog
        open={archiveTarget !== null}
        title="Archive Group?"
        preview={archiveTarget ? archiveTarget.name : ""}
        subtitle="Existing users keep the group, but new users cannot select it."
        reversible
        confirmLabel="Archive"
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
