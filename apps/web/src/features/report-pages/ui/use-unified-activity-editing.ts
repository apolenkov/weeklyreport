"use client";

import { useState } from "react";

import type { ActivityBucket } from "../../../lib/activity-buckets";
import type { KanbanItem } from "../../report-sections";

// Bucket is a projection; week is persisted Item.type and never changes here (ADR 0011).
export interface UnifiedActivityEntry {
  readonly item: KanbanItem;
  readonly bucket: ActivityBucket;
  readonly week: "current" | "next";
}

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
    if (entry.item.foreign === true) return;
    setPendingDelete(entry);
  }

  function saveEdited(next: KanbanItem) {
    if (!editState) return;
    const week = editState.entry.week;
    onWeekItemsChange?.(week, replaceWeekItem(entries, week, next));
    setEditState(null);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const week = pendingDelete.week;
    onWeekItemsChange?.(
      week,
      removeWeekItem(entries, week, pendingDelete.item.id),
    );
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
