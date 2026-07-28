"use client";

import type { ActivityBucket } from "../../../lib/activity-buckets";
import type { KanbanItem, Product, RiskEntry } from "../../report-sections";
import {
  ActivityBucketList,
  EmptyActivityPlaceholder,
} from "./activity-bucket-list";
import { UnifiedActivityDialogs } from "./unified-activity-dialogs";
import { useUnifiedActivityEditing } from "./use-unified-activity-editing";

// Bucket is a projection; week is persisted Item.type and never changes here (ADR 0011).
export interface UnifiedActivityEntry {
  readonly item: KanbanItem;
  readonly bucket: ActivityBucket;
  readonly week: "current" | "next";
}

interface UnifiedActivitySectionProps {
  readonly entries: readonly UnifiedActivityEntry[];
  // Own risks for ItemCard alarm derivation (parity with Current/Next); activity
  // items skip derivation (no product-stage parent).
  readonly risks?: readonly RiskEntry[] | undefined;
  readonly readOnly?: boolean | undefined;
  // Per-week items so the parent reuses existing per-type merge handlers.
  readonly onWeekItemsChange?:
    ((week: "current" | "next", items: KanbanItem[]) => void) | undefined;
  readonly currentUserName?: string | undefined;
  readonly products?: readonly Product[] | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly ownPeriodRanks?: readonly number[] | undefined;
  readonly publishedLockedIds?: ReadonlySet<string> | undefined;
  readonly onMarkComplete?: ((id: string) => void) | undefined;
  readonly onMoveToNextWeek?: ((id: string) => void) | undefined;
}

// Opt-in by-state view (AppSettings.unifiedActivityView); create is via quick-add.
export function UnifiedActivitySection({
  entries,
  risks,
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
  const editing = useUnifiedActivityEditing({
    entries,
    readOnly,
    onWeekItemsChange,
  });

  if (entries.length === 0) {
    return <EmptyActivityPlaceholder />;
  }

  return (
    <div className="space-y-5" data-testid="unified-activity-section">
      <ActivityBucketList
        entries={entries}
        risks={risks}
        readOnly={readOnly}
        publishedLockedIds={publishedLockedIds}
        onEdit={editing.requestEdit}
        onDelete={editing.requestDelete}
        onMarkComplete={onMarkComplete}
        onMoveToNextWeek={onMoveToNextWeek}
      />
      <UnifiedActivityDialogs
        editState={editing.editState}
        pendingDelete={editing.pendingDelete}
        products={products ?? []}
        currentUserName={currentUserName}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        risks={risks}
        onSave={editing.saveEdited}
        onCancelEdit={editing.cancelEdit}
        onConfirmDelete={editing.confirmDelete}
        onCancelDelete={editing.cancelDelete}
      />
    </div>
  );
}
