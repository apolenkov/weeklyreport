"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { KanbanItem } from "../types";
import type { UnifiedActivityEntry } from "./unified-activity-entry";

export interface UnifiedActivityEditState {
  readonly entry: UnifiedActivityEntry;
  readonly seq: number;
}

function weekItems(
  entries: readonly UnifiedActivityEntry[],
  week: "current" | "next",
): KanbanItem[] {
  return entries
    .filter((entry) => entry.week === week)
    .map((entry) => entry.item);
}

function replaceWeekItem(
  entries: readonly UnifiedActivityEntry[],
  week: "current" | "next",
  next: KanbanItem,
): KanbanItem[] {
  return weekItems(entries, week).map((item) =>
    item.id === next.id ? next : item,
  );
}

// Every save remints physical item ids, so a captured entry can outlive its
// own id while the dialog is open. Re-resolve against the latest entries of
// the SAME week: exact id first, then exactly one own row sharing the captured
// stableId. Anything else — missing, moved, foreign, ambiguous, or a
// still-unreconciled temporary row — is unsafe to write.
function resolveLiveEntry(
  captured: UnifiedActivityEntry,
  entries: readonly UnifiedActivityEntry[],
): UnifiedActivityEntry | null {
  const sameWeek = entries.filter(
    (entry) => entry.week === captured.week && entry.item.foreign !== true,
  );
  const exact = sameWeek.find((entry) => entry.item.id === captured.item.id);
  if (exact) return exact;
  const stableId = captured.item.stableId;
  if (stableId == null || stableId === "") return null;
  const byStable = sameWeek.filter((entry) => entry.item.stableId === stableId);
  return byStable.length === 1 ? (byStable[0] ?? null) : null;
}

function removeWeekItem(
  entries: readonly UnifiedActivityEntry[],
  week: "current" | "next",
  itemId: string,
): KanbanItem[] {
  return weekItems(entries, week).filter((item) => item.id !== itemId);
}

interface UnifiedActivityEditingArgs {
  readonly entries: readonly UnifiedActivityEntry[];
  readonly readOnly: boolean;
  readonly onWeekItemsChange?:
    ((week: "current" | "next", items: KanbanItem[]) => void) | undefined;
}

// Foreign records are read-only regardless of the section's own lock, so both
// entry points bail before touching state.
export function useUnifiedActivityEditing({
  entries,
  readOnly,
  onWeekItemsChange,
}: UnifiedActivityEditingArgs) {
  const [editState, setEditState] = useState<UnifiedActivityEditState | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] =
    useState<UnifiedActivityEntry | null>(null);

  function requestEdit(entry: UnifiedActivityEntry) {
    if (readOnly || entry.item.foreign === true) return;
    setEditState((prev) => ({ entry, seq: (prev?.seq ?? 0) + 1 }));
  }

  function requestDelete(entry: UnifiedActivityEntry) {
    if (readOnly || entry.item.foreign === true) return;
    setPendingDelete(entry);
  }

  // A commit that cannot find its live row must neither emit an unchanged
  // write nor close the dialog over the user's unsaved input.
  function staleTarget() {
    toast.error("This record changed — reopen it from the current list.");
  }

  function saveEdited(next: KanbanItem) {
    if (readOnly || !editState) return;
    const live = resolveLiveEntry(editState.entry, entries);
    if (!live || !onWeekItemsChange || next.id !== editState.entry.item.id) {
      staleTarget();
      return;
    }
    const week = editState.entry.week;
    onWeekItemsChange(
      week,
      replaceWeekItem(entries, week, {
        ...next,
        id: live.item.id,
        stableId: live.item.stableId,
      }),
    );
    setEditState(null);
  }

  function confirmDelete() {
    if (readOnly || !pendingDelete) return;
    const live = resolveLiveEntry(pendingDelete, entries);
    if (!live || !onWeekItemsChange) {
      staleTarget();
      return;
    }
    const week = pendingDelete.week;
    onWeekItemsChange(week, removeWeekItem(entries, week, live.item.id));
    setPendingDelete(null);
  }

  return {
    editState,
    pendingDelete,
    requestEdit,
    requestDelete,
    saveEdited,
    confirmDelete,
    cancelEdit: () => setEditState(null),
    cancelDelete: () => setPendingDelete(null),
  };
}
