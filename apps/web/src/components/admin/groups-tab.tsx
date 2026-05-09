"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import { toReportingGroupInput } from "../../lib/mappers";
import { useTRPC } from "../../lib/trpc-context";

import { TabHeader, TabSearch } from "./tab-header";

import type { MockGroup } from "./mock-data";

type GroupFormData = {
  name: string;
  description: string;
};

const EMPTY_FORM: GroupFormData = { name: "", description: "" };

type GroupsTabProps = {
  readonly groups: MockGroup[];
};

export function GroupsTab({ groups }: GroupsTabProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [editingGroup, setEditingGroup] = useState<MockGroup | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MockGroup | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<GroupFormData>(EMPTY_FORM);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!showDialog) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowDialog(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showDialog]);

  const saveGroupMut = useMutation(
    trpc.admin.saveReportingGroup.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Group saved");
        setShowDialog(false);
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to save group");
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
        toast.error(err.message ?? "Failed to archive group");
      },
    }),
  );

  function openAdd() {
    setEditingGroup(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  }

  function openEdit(group: MockGroup) {
    setEditingGroup(group);
    setForm({
      name: group.name,
      description: group.description ?? "",
    });
    setShowDialog(true);
  }

  function handleSave() {
    saveGroupMut.mutate(
      toReportingGroupInput(
        { ...form, archived: editingGroup?.archived ?? false },
        editingGroup?.id,
      ),
    );
  }

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((group) =>
      [
        group.name,
        group.description ?? "",
        group.archived ? "archived" : "active",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [groups, search]);

  const isSaving = saveGroupMut.isPending;
  const isArchiving = archiveGroupMut.isPending;
  const canSave = form.name.trim().length > 0 && !isSaving;
  const activeGroupCount = groups.filter((group) => !group.archived).length;

  return (
    <>
      <div className="space-y-4" data-testid="groups-tab">
        <TabHeader
          title="Groups"
          description={`Reporting groups (departments). ${activeGroupCount} active.`}
          count={`${groups.length} groups`}
          search={
            <TabSearch
              value={search}
              onChange={setSearch}
              placeholder="Search groups…"
              testId="groups-search"
              ariaLabel="Search groups"
            />
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

        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table
            className="w-full text-left text-sm"
            data-testid="groups-table"
          >
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Name
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Description
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => (
                <tr
                  key={group.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[#f8f6f2]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
                    {group.name}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {group.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        group.archived
                          ? "inline-flex rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-muted-foreground)]"
                          : "inline-flex rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary)]"
                      }
                    >
                      {group.archived ? "Archived" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(group)}
                        className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[rgba(0,117,74,0.3)] hover:bg-[var(--color-success)]"
                        aria-label={`Edit ${group.name}`}
                      >
                        Edit
                      </button>
                      {!group.archived && activeGroupCount > 1 && (
                        <button
                          type="button"
                          onClick={() => setArchiveTarget(group)}
                          className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-destructive)] transition-colors hover:border-[rgba(200,32,20,0.3)] hover:bg-red-50"
                          aria-label={`Archive ${group.name}`}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredGroups.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[#fafaf7] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            No groups match the search.
          </div>
        )}
      </div>

      {showDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={() => setShowDialog(false)}
          role="presentation"
          data-testid="crud-sheet"
        >
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={editingGroup ? "Edit group" : "Add group"}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              {editingGroup ? "Edit Group" : "Add Group"}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="group-name"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Name
                </label>
                <input
                  id="group-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div>
                <label
                  htmlFor="group-description"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Description
                </label>
                <textarea
                  id="group-description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                disabled={isSaving}
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "Saving…"
                  : editingGroup
                    ? "Save Changes"
                    : "Add Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-sm rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm archive"
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              Archive Group?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Archive {archiveTarget.name}? Existing users keep the group, but
              new users cannot select it.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                disabled={isArchiving}
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  archiveGroupMut.mutate({ groupId: archiveTarget.id })
                }
                disabled={isArchiving}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-destructive)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isArchiving ? "Archiving…" : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
