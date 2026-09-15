"use client";

import { useEditableListDialog } from "../../../../shared/hooks/dialogs/use-editable-list-dialog";
import type { UnifiedActivityEntry } from "../../model/activity/unified-activity-entry";
import { useUnifiedActivityEditing } from "../../model/activity/use-unified-activity-editing";
import type { KanbanItem, Product, RiskEntry } from "../../model/types";
import { ItemEditDialog, type ItemEditDialogProps } from "../item-edit-dialog";
import {
  ActivityBucketList,
  EmptyActivityPlaceholder,
} from "./activity-bucket-list";
import { UnifiedActivityDialogs } from "./unified-activity-dialogs";

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
  readonly activities?: ItemEditDialogProps["activities"];
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly ownPeriodRanks?: readonly number[] | undefined;
  readonly addSignal?: number | undefined;
  readonly publishedLockedIds?: ReadonlySet<string> | undefined;
  readonly onMarkComplete?: ((id: string) => void) | undefined;
  readonly onMoveToNextWeek?: ((id: string) => void) | undefined;
}

// Opt-in by-state view (AppSettings.unifiedActivityView).
export function UnifiedActivitySection({
  entries,
  risks,
  readOnly = false,
  onWeekItemsChange,
  currentUserName,
  products,
  activities,
  stagesForProduct,
  ownPeriodRanks,
  addSignal = 0,
  publishedLockedIds,
  onMarkComplete,
  onMoveToNextWeek,
}: UnifiedActivitySectionProps) {
  const editing = useUnifiedActivityEditing({
    entries,
    readOnly,
    onWeekItemsChange,
  });
  const defaultProduct = products?.[0];
  const defaultActivityId = defaultProduct ? undefined : activities?.[0]?.id;
  const creation = useEditableListDialog<KanbanItem>({
    readOnly,
    addSignal,
    seedProductId: defaultProduct?.id,
    seedActivityId: defaultActivityId,
    requireSeed: true,
  });
  const isCreating =
    creation.dialogState.open && creation.dialogState.mode === "create";
  const currentItems = entries
    .filter((entry) => entry.week === "current")
    .map((entry) => entry.item);

  function saveCreated(next: KanbanItem): void {
    if (readOnly) return;
    onWeekItemsChange?.("current", [...currentItems, next]);
    creation.close();
  }

  return (
    <div className="space-y-5" data-testid="unified-activity-section">
      {entries.length === 0 ? (
        <EmptyActivityPlaceholder readOnly={readOnly} />
      ) : (
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
      )}
      <UnifiedActivityDialogs
        editState={editing.editState}
        pendingDelete={editing.pendingDelete}
        products={products ?? []}
        activities={activities}
        currentUserName={currentUserName}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        risks={risks}
        onSave={editing.saveEdited}
        onCancelEdit={editing.cancelEdit}
        onConfirmDelete={editing.confirmDelete}
        onCancelDelete={editing.cancelDelete}
      />
      <ItemEditDialog
        key={creation.dialogKey}
        open={isCreating}
        item={null}
        products={products ?? []}
        activities={activities}
        week="current"
        currentUserName={currentUserName}
        defaultProductId={
          isCreating ? creation.dialogState.seedProductId : undefined
        }
        defaultActivityId={
          isCreating ? creation.dialogState.seedActivityId : undefined
        }
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        risks={risks}
        onSave={saveCreated}
        onCancel={creation.close}
      />
    </div>
  );
}
