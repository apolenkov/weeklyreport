"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";
import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { toReportingGroupInput } from "../model/admin";
import { TabFilter, TabHeader, TabSearch } from "./tab-header";

// B4: archive quick-filter — default "active" hides archived groups on load
const ARCHIVE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;
type ArchiveFilterValue = (typeof ARCHIVE_OPTIONS)[number]["value"];

import type {
  MockGroup,
  MockProduct,
  MockUser,
} from "../../../shared/lib/admin-mock-data";
import { GroupProductsEditor } from "./group-products-editor";

interface GroupFormData {
  name: string;
  description: string;
  headUserId: string; // empty string = no leader
  archived: boolean;
}

const EMPTY_FORM: GroupFormData = {
  name: "",
  description: "",
  headUserId: "",
  archived: false,
};

interface GroupsTabProps {
  readonly groups: MockGroup[];
  readonly users: MockUser[];
  // UFB-054 / Phase 56-C: product roster for the «Products attached»
  // section inside the edit dialog. Optional so legacy callers that
  // don't yet thread products through (e.g. unit tests) keep
  // compiling — the section short-circuits to an empty list.
  readonly products?: MockProduct[];
}

export function GroupsTab({ groups, users, products = [] }: GroupsTabProps) {
  // UFB-039: only head/admin users may lead a group. Filter the candidate
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
  const [form, setForm] = useState<GroupFormData>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  // B4: archive quick-filter (default "active" — hides archived groups on load)
  const [archiveFilter, setArchiveFilter] =
    useState<ArchiveFilterValue>("active");

  // Save the trigger element so the shared focus primitive can restore focus
  // to it when the dialog closes (Escape, Cancel, backdrop, save success).
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape-to-close + restore-to-trigger via the shared primitive.
  useDialogFocus({
    open: showDialog,
    onClose: () => setShowDialog(false),
    containerRef: dialogSurfaceRef,
    triggerRef: dialogTriggerRef,
  });

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
    dialogTriggerRef.current = document.activeElement as HTMLElement;
    setEditingGroup(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  }

  function openEdit(group: MockGroup) {
    dialogTriggerRef.current = document.activeElement as HTMLElement;
    setEditingGroup(group);
    setForm({
      name: group.name,
      description: group.description ?? "",
      headUserId: group.headUserId ?? "",
      archived: group.archived,
    });
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
  const isArchiving = archiveGroupMut.isPending;
  const canSave = form.name.trim().length > 0 && !isSaving;
  const activeGroupCount = groups.filter((group) => !group.archived).length;

  return (
    <>
      <div className="space-y-4" data-testid="groups-tab">
        {/* UFB-049 (2026-05-11): revert 48-A Department sweep —
            user wants "Group/Groups" in admin UI. Prisma model
            (ReportingGroup) and test ids unchanged. */}
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
                  Leader
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
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
                    {group.name}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {group.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-foreground)]">
                    {group.headUserId
                      ? (headById.get(group.headUserId)?.name ?? "—")
                      : "—"}
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
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
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
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops backdrop close-propagation; no keyboard equivalent needed (dialog closes via Escape + Cancel button) */}
          <div
            ref={dialogSurfaceRef}
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
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
                  autoFocus
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
              <div>
                <label
                  htmlFor="group-leader"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Leader
                </label>
                <select
                  id="group-leader"
                  value={form.headUserId}
                  onChange={(e) =>
                    setForm({ ...form, headUserId: e.target.value })
                  }
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                >
                  <option value="">— No leader —</option>
                  {headCandidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                {headCandidates.length === 0 && (
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    No users with role &lsquo;head&rsquo; or &lsquo;admin&rsquo;
                    available.
                  </p>
                )}
              </div>
              {editingGroup && (
                <div>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.archived}
                      onChange={(e) =>
                        setForm({ ...form, archived: e.target.checked })
                      }
                      className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                    />
                    <span className="block text-sm">
                      <span className="font-medium text-[var(--color-foreground)]">
                        Archived
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                        Hidden from new user/group pickers; existing references
                        keep working.
                      </span>
                    </span>
                  </label>
                </div>
              )}
              {editingGroup && (
                <GroupProductsEditor
                  groupId={editingGroup.id}
                  products={products}
                />
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                disabled={isSaving}
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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
