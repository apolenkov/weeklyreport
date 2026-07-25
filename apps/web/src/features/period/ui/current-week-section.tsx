"use client";

import { useRef } from "react";

import type { EditableListDialogState } from "../../../hooks/use-editable-list-dialog";
import { useEditableListDialog } from "../../../hooks/use-editable-list-dialog";
import { usePauseReason } from "../../../hooks/use-pause-reason";
import { useScrollFade } from "../../../hooks/use-scroll-fade";
import type { KanbanItem } from "../../report-sections";
import {
  BoardEmptyState,
  isBoardEmpty,
  ItemCard,
  splitItemBoard,
} from "../../report-sections";
import { AddItemButton } from "./current-week-add-button";
import { CurrentWeekBoardGrid } from "./current-week-board-grid";
import { CurrentWeekDialogs } from "./current-week-dialogs";
import type { CurrentWeekSectionProps } from "./current-week-section.types";

function deriveDialogProps(dialogState: EditableListDialogState<KanbanItem>): {
  editItem: KanbanItem | null;
  createSeedProductId: string | undefined;
  createSeedActivityId: string | undefined;
} {
  const isEdit = dialogState.open && dialogState.mode === "edit";
  const isCreate = dialogState.open && dialogState.mode === "create";
  return {
    editItem: isEdit ? dialogState.entity : null,
    createSeedProductId: isCreate ? dialogState.seedProductId : undefined,
    createSeedActivityId: isCreate ? dialogState.seedActivityId : undefined,
  };
}

/**
 * Current Week Section.
 * @param props - The props argument.
 */
export function CurrentWeekSection({
  items,
  risks,
  readOnly = false,
  onItemsChange,
  currentUserName,
  products,
  activities,
  stagesForProduct,
  ownPeriodRanks,
  addSignal = 0,
  publishedLockedIds,
  onMarkComplete,
  onMoveToNextWeek,
  onPauseItem,
}: CurrentWeekSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canScrollDown = useScrollFade(scrollRef);

  // The pause-reason prompt lifecycle lives in a hook so
  // a card's Pause button only needs to name the item.
  const pause = usePauseReason<KanbanItem>(onPauseItem);

  // Only fall back to the standalone empty-state when there are neither
  // items nor products to drive a column layout.
  const isEmpty = isBoardEmpty(items, products, activities);
  const hasMultipleProducts = products != null && products.length > 1;
  const defaultProduct = products?.[0];

  // Shared dialog lifecycle (DialogState union, readOnly-ref add-signal
  // effect, openSeq remount key, pending-delete). requireSeed: this section
  // can only open create mode when a product column exists.
  const {
    dialogState,
    dialogKey,
    openCreate,
    openEdit,
    close,
    pendingDelete,
    requestDelete,
    clearPendingDelete,
  } = useEditableListDialog<KanbanItem>({
    readOnly,
    addSignal,
    seedProductId: defaultProduct?.id,
    requireSeed: true,
  });

  const globalAddButton = !readOnly && (
    <AddItemButton
      defaultProduct={defaultProduct}
      onAdd={(productId) => openCreate({ productId })}
    />
  );

  function handleDelete(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    requestDelete(item);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    onItemsChange?.(items.filter((i) => i.id !== pendingDelete.id));
    clearPendingDelete();
  }

  function handleEdit(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    openEdit(item);
  }

  function handleDialogSave(next: KanbanItem) {
    if (readOnly) return;
    if (dialogState.open && dialogState.mode === "create") {
      onItemsChange?.([...items, next]);
    } else {
      onItemsChange?.(items.map((i) => (i.id === next.id ? next : i)));
    }
    close();
  }

  function handleDialogCancel() {
    close();
  }

  if (isEmpty) {
    return (
      <BoardEmptyState
        readOnly={readOnly}
        readOnlyLabel="No current-week items."
        editableLabel="No current-week items yet."
        addButton={globalAddButton}
      />
    );
  }

  // One column per assigned product (including empty) so `+ Add` stays visible.
  // Falls back to non-empty groups when products is omitted. Activity lanes
  // sit below the grid, never as peer product columns.
  const board = splitItemBoard(products, items, activities);
  const dlg = deriveDialogProps(dialogState);

  const renderItem = (item: KanbanItem) => (
    <ItemCard
      key={item.id}
      item={item}
      risks={risks}
      readOnly={readOnly}
      isEditing={false}
      publishedLocked={publishedLockedIds?.has(item.id)}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onMarkComplete={onMarkComplete}
      onMoveToNextWeek={onMoveToNextWeek}
      {...(onPauseItem && !readOnly
        ? { onPause: () => pause.request(item) }
        : {})}
    />
  );

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard-focusable (axe scrollable-region-focusable); the static rule does not model that WCAG exception
        tabIndex={0}
        role="group"
        aria-label="Current week items"
        className="max-h-[420px] overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        <CurrentWeekBoardGrid
          productColumns={board.productColumns}
          activityLanes={board.activityLanes}
          readOnly={readOnly}
          hasMultipleProducts={hasMultipleProducts}
          onAdd={openCreate}
          renderItem={renderItem}
        />

        <CurrentWeekDialogs
          dialogKey={dialogKey}
          open={dialogState.open}
          editItem={dlg.editItem}
          products={products ?? []}
          activities={activities}
          currentUserName={currentUserName}
          createSeedProductId={dlg.createSeedProductId}
          createSeedActivityId={dlg.createSeedActivityId}
          stagesForProduct={stagesForProduct}
          ownPeriodRanks={ownPeriodRanks}
          risks={risks}
          onSave={handleDialogSave}
          onCancel={handleDialogCancel}
          pendingDelete={pendingDelete}
          onConfirmDelete={confirmDelete}
          onCancelDelete={clearPendingDelete}
          pausePending={pause.pending}
          onConfirmPause={pause.confirm}
          onCancelPause={pause.cancel}
        />
      </div>
      {canScrollDown && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 rounded-b-lg"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--color-card))",
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
