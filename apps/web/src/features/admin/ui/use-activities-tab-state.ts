"use client";

import type { ProjectActivity } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { useActivityMutations } from "../model/activities-tab-mutations";
import {
  type ActivityFormData,
  EMPTY_ACTIVITY_FORM,
  formFromActivity,
  parseJiraAccounts,
} from "../model/activity-form";

function useActivityDialog() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingActivity, setEditingActivity] =
    useState<ProjectActivity | null>(null);
  const [form, setForm] = useState<ActivityFormData>(EMPTY_ACTIVITY_FORM);

  return {
    showDialog,
    editingActivity,
    form,
    setForm,
    closeDialog: () => setShowDialog(false),
    openAdd: () => {
      setEditingActivity(null);
      // No silent group preselection: the admin picks the group explicitly,
      // and canSave blocks an empty picker from submitting.
      setForm({ ...EMPTY_ACTIVITY_FORM });
      setShowDialog(true);
    },
    openEdit: (activity: ProjectActivity) => {
      setEditingActivity(activity);
      setForm(formFromActivity(activity));
      setShowDialog(true);
    },
  };
}

function useActivityFilters(activities: readonly ProjectActivity[]) {
  const [localSearch, setLocalSearch] = useState("");

  const needle = localSearch.trim().toLowerCase();
  const filtered = useMemo(() => {
    return needle
      ? activities.filter((a) => a.name.toLowerCase().includes(needle))
      : activities;
  }, [activities, needle]);

  return {
    localSearch,
    isFiltering: needle !== "",
    setLocalSearch,
    activeActivities: filtered.filter((a) => !a.archived),
    archivedActivities: filtered.filter((a) => a.archived),
  };
}

function useActivityExpansion() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return {
    expandedId,
    toggleExpand: (id: string) =>
      setExpandedId((current) => (current === id ? null : id)),
  };
}

function useActivityArchive(
  setArchived: (input: { id: string; archived: boolean }) => void,
) {
  const [pendingArchive, setPendingArchive] = useState<ProjectActivity | null>(
    null,
  );
  return {
    pendingArchive,
    setPendingArchive,
    confirmArchive: () => {
      if (!pendingArchive) return;
      setArchived({ id: pendingArchive.id, archived: true });
      setPendingArchive(null);
    },
    handleRestore: (activity: ProjectActivity) =>
      setArchived({ id: activity.id, archived: false }),
  };
}

export function useActivitiesTabState() {
  const trpc = useTRPC();
  const activitiesQuery = useQuery(trpc.projectActivity.list.queryOptions());
  // Log-only: the tab already surfaces the failure via AdminQueryIssue.
  useQueryErrorHandler(activitiesQuery, {
    component: "ActivitiesTab",
    event: "admin.activities.load_failed",
    procedure: "projectActivity.list",
  });
  const activities = activitiesQuery.data ?? [];

  const dialog = useActivityDialog();
  const filters = useActivityFilters(activities);
  const expansion = useActivityExpansion();
  const { createMut, updateMut, archiveMut } = useActivityMutations(
    dialog.closeDialog,
  );
  const archive = useActivityArchive(archiveMut.mutate);

  // groupId is a required uuid on the wire — an empty picker must not submit.
  const canSave =
    dialog.form.name.trim().length > 0 && dialog.form.groupId !== null;

  const handleSave = () => {
    if (dialog.form.groupId === null) return;
    const payload = {
      name: dialog.form.name.trim(),
      groupId: dialog.form.groupId,
      linkedProductIds: [...dialog.form.linkedProductIds],
      jiraAccounts: parseJiraAccounts(dialog.form.jiraAccounts),
    };
    const editing = dialog.editingActivity;
    if (editing) {
      updateMut.mutate({ ...payload, id: editing.id });
    } else {
      createMut.mutate(payload);
    }
  };

  return {
    ...dialog,
    ...filters,
    ...expansion,
    ...archive,
    handleSave,
    canSave,
    isLoading: activitiesQuery.isLoading,
    isError: activitiesQuery.isError,
    retry: () => {
      void activitiesQuery.refetch().catch(() => undefined);
    },
    isSaving: createMut.isPending || updateMut.isPending,
    isArchiving: archiveMut.isPending,
  };
}
