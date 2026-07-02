"use client";

import { useState } from "react";

import {
  ACTIVITY_BUCKET_LABELS,
  ACTIVITY_BUCKET_ORDER,
  type ActivityBucket,
} from "../../lib/activity-buckets";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ItemCard } from "./item-card";
import { ItemEditDialog } from "./item-edit-dialog";
import type { KanbanItem, Product } from "./mock-data";

/**
 * One row of the unified view: a presentation item plus its derived bucket
 * and the physical week it is stored under. The bucket is a projection —
 * `week` is the persisted `Item.type` and never changes here (ADR 0011).
 */
export interface UnifiedActivityEntry {
  readonly item: KanbanItem;
  readonly bucket: ActivityBucket;
  readonly week: "current" | "next";
}

interface UnifiedActivitySectionProps {
  readonly entries: readonly UnifiedActivityEntry[];
  readonly readOnly?: boolean;
  /**
   * Controlled-component callback mirroring CurrentWeekSection /
   * NextWeekSection: fired with the next items array FOR ONE WEEK on edit or
   * delete, so the parent reuses its existing per-type merge handlers.
   */
  readonly onWeekItemsChange?: (
    week: "current" | "next",
    items: KanbanItem[],
  ) => void;
  readonly currentUserName?: string;
  readonly products?: readonly Product[];
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly ownPeriodRanks?: readonly number[];
  /** Item ids whose lineage is published (resolve-not-delete marker). */
  readonly publishedLockedIds?: ReadonlySet<string>;
  /** In-place move action for current-week open items. */
  readonly onMarkComplete?: (id: string) => void;
  /** In-place move action for current-week open items. */
  readonly onMoveToNextWeek?: (id: string) => void;
}

interface EditState {
  readonly entry: UnifiedActivityEntry;
  /** Remount key so the dialog re-seeds its state per open. */
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

/**
 * The opt-in unified by-state view: one section folding current-week and
 * next-week items into groups derived by `deriveActivityBucket`. Rendered
 * only when the org `AppSettings.unifiedActivityView` flag is on; the
 * classic two-section format stays the default. Creation goes through the
 * quick-add affordance — this section edits, deletes, and moves.
 */
export function UnifiedActivitySection({
  entries,
  readOnly = false,
  onWeekItemsChange,
  currentUserName,
  products,
  stagesForProduct,
  ownPeriodRanks,
  publishedLockedIds,
  onMarkComplete,
  onMoveToNextWeek,
}: UnifiedActivitySectionProps) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<UnifiedActivityEntry | null>(null);

  const buckets = ACTIVITY_BUCKET_ORDER.map((bucket) => ({
    bucket,
    entries: entries.filter((entry) => entry.bucket === bucket),
  })).filter((group) => group.entries.length > 0);

  function handleEdit(entry: UnifiedActivityEntry) {
    if (readOnly || entry.item.foreign === true) return;
    setEditState((prev) => ({ entry, seq: (prev?.seq ?? 0) + 1 }));
  }

  function handleDialogSave(next: KanbanItem) {
    if (!editState) return;
    const week = editState.entry.week;
    onWeekItemsChange?.(
      week,
      weekItems(entries, week).map((item) =>
        item.id === next.id ? next : item,
      ),
    );
    setEditState(null);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const week = pendingDelete.week;
    onWeekItemsChange?.(
      week,
      weekItems(entries, week).filter(
        (item) => item.id !== pendingDelete.item.id,
      ),
    );
    setPendingDelete(null);
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
        No items yet — use the + Add button to create one.
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="unified-activity-section">
      {buckets.map((group) => (
        <div key={group.bucket}>
          <div className="mb-2 flex items-center gap-2">
            <span
              data-testid={`bucket-label-${group.bucket}`}
              className="font-[family-name:var(--font-sans)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]"
            >
              {ACTIVITY_BUCKET_LABELS[group.bucket]}
            </span>
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted-foreground)]">
              {group.entries.length}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.entries.map((entry) => (
              <ItemCard
                key={`${entry.week}-${entry.item.id}`}
                item={entry.item}
                readOnly={readOnly}
                isEditing={false}
                publishedLocked={publishedLockedIds?.has(entry.item.id)}
                onEdit={() => handleEdit(entry)}
                onDelete={() => {
                  if (entry.item.foreign === true) return;
                  setPendingDelete(entry);
                }}
                onMarkComplete={
                  entry.week === "current" && entry.bucket !== "done"
                    ? onMarkComplete
                    : undefined
                }
                onMoveToNextWeek={
                  entry.week === "current" && entry.bucket !== "done"
                    ? onMoveToNextWeek
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      ))}

      {/* Edit dialog — the EXISTING per-type item dialog; `week` follows the
          record's physical type so the status chips match its storage. */}
      <ItemEditDialog
        key={editState?.seq ?? 0}
        open={editState !== null}
        item={editState?.entry.item ?? null}
        products={products ?? []}
        week={editState?.entry.week ?? "current"}
        currentUserName={currentUserName}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        onSave={handleDialogSave}
        onCancel={() => setEditState(null)}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete item?"
        preview={pendingDelete?.item.text ?? ""}
        subtitle={
          pendingDelete ? `From ${pendingDelete.item.productName}` : undefined
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
