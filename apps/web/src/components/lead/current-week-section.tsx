"use client";

import { useRef } from "react";

import type { EditableListDialogState } from "../../hooks/use-editable-list-dialog";
import { useEditableListDialog } from "../../hooks/use-editable-list-dialog";
import { usePauseReason } from "../../hooks/use-pause-reason";
import { useScrollFade } from "../../hooks/use-scroll-fade";
import { ActivityLanesBlock } from "./activity-lanes-block";
import { BoardColumnHeader } from "./board-column-header";
import { BoardEmptyState } from "./board-empty-state";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ItemCard } from "./item-card";
import { ItemEditDialog } from "./item-edit-dialog";
import type { KanbanItem, Product, RiskEntry } from "./mock-data";
import { isBoardEmpty, splitItemBoard } from "./next-week-columns";
import { PauseReasonDialog } from "./pause-reason-dialog";

const MAX_GRID_COLUMNS = 3;

interface CurrentWeekSectionProps {
  readonly items: KanbanItem[];
  /**
   * record-status-derived-from-risk: own risks forwarded to each ItemCard so
   * its at-risk/blocked pill derives from the covering risks, never a free item
   * status.
   */
  readonly risks?: readonly RiskEntry[];
  readonly readOnly?: boolean;
  /**
   * Controlled-component callback fired with the next items array on add /
   * inline-edit / delete. The parent must merge this back into its raw
   * `draftSection.items` keyed by id, preserving non-presentation fields
   * (tag, workflowStatus, carriedOver, completed, type).
   */
  readonly onItemsChange?: (items: KanbanItem[]) => void;
  /**
   * Author label used as the default `author` for newly-created items.
   * Falls back to "You" when undefined.
   */
  readonly currentUserName?: string;
  /**
   * Used as the seed product for the empty-state `+ Add` button. Without
   * this prop the section would have no per-product group to attach the
   * Add button to once all items are deleted, leaving a dead section.
   */
  readonly products?: readonly Product[];
  /**
   * activity-first-class: the author's attached activities forwarded to
   * ItemEditDialog so the parent picker can offer them alongside products.
   */
  readonly activities?: readonly { id: string; name: string }[];
  /**
   * 35-04: stages-the-lead-owns selector forwarded to ItemEditDialog so
   * the SDLC stage dropdown is scoped to the active project.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * All priority ranks already in use by own items for the full period
   * (current + next week). Forwarded to ItemEditDialog so taken ranks are
   * disabled in the picker. The dialog subtracts the edited item's own
   * current rank before computing the disabled set.
   */
  readonly ownPeriodRanks?: readonly number[];
  readonly addSignal?: number;
  /**
   * Resolve-not-delete (ADR 0015): item ids whose lineage appeared in a
   * published report — the card shows the marker and withholds Delete.
   */
  readonly publishedLockedIds?: ReadonlySet<string>;
  /** In-place move action (same durable identity; see ItemCardActions). */
  readonly onMarkComplete?: (id: string) => void;
  /** In-place move action (same durable identity; see ItemCardActions). */
  readonly onMoveToNextWeek?: (id: string) => void;
  /**
   * require-paused-item-reason: pause an in-progress item with a required
   * reason. The section owns the reason prompt; this persists the result.
   */
  readonly onPauseItem?: (id: string, reason: string) => void;
}

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

  // require-paused-item-reason: the reason prompt lifecycle lives in a hook so
  // a card's Pause button only needs to name the item.
  const pause = usePauseReason<KanbanItem>(onPauseItem);

  // Only fall back to the standalone empty-state when there are neither
  // items nor products to drive a column layout.
  const isEmpty = isBoardEmpty(items, products, activities);
  const hasMultipleProducts = products != null && products.length > 1;
  const defaultProduct = products?.[0];

  // Shared dialog lifecycle (DialogState union, D1 readOnly-ref add-signal
  // effect, D13 openSeq remount key, pending-delete). requireSeed: this
  // section can only open create mode when a product column exists.
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
    <div className="flex justify-end">
      <button
        type="button"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() =>
          defaultProduct && openCreate({ productId: defaultProduct.id })
        }
        disabled={!defaultProduct}
        title={
          defaultProduct
            ? `Add item to ${defaultProduct.name}`
            : "No products assigned — contact admin"
        }
      >
        + Add Item
      </button>
    </div>
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

  // Render one column per assigned product (not per non-empty group), so
  // that products with zero items still surface a `+ Add` CTA in their
  // column. Falls back to non-empty groups when `products` isn't passed
  // (defensive — the prop became required de-facto in May 2026 but
  // existing callers may still omit it). Activity lanes render in their own
  // lighter block BELOW the grid — never as peer product columns.
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
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(Math.max(board.productColumns.length, 1), MAX_GRID_COLUMNS)}, minmax(0, 1fr))`,
          }}
        >
          {board.productColumns.map((col) => (
            <div key={col.key} className="min-w-0">
              <BoardColumnHeader
                col={col}
                readOnly={readOnly}
                showProductAdd={hasMultipleProducts}
                onAdd={openCreate}
              />
              {col.items.length === 0 ? (
                <div
                  className="flex items-center justify-center rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[var(--color-surface-hover)] p-3 text-center text-xs text-[var(--color-muted-foreground)]"
                  style={{ minHeight: 150 }}
                >
                  No items yet
                </div>
              ) : (
                <div className="space-y-2">{col.items.map(renderItem)}</div>
              )}
            </div>
          ))}
        </div>

        <ActivityLanesBlock
          lanes={board.activityLanes}
          readOnly={readOnly}
          onAdd={openCreate}
          renderItem={renderItem}
        />

        {/* Edit / Add modal — single instance shared across all columns. */}
        <ItemEditDialog
          key={dialogKey}
          open={dialogState.open}
          item={dlg.editItem}
          products={products ?? []}
          activities={activities}
          week="current"
          currentUserName={currentUserName}
          defaultProductId={dlg.createSeedProductId}
          defaultActivityId={dlg.createSeedActivityId}
          stagesForProduct={stagesForProduct}
          ownPeriodRanks={ownPeriodRanks}
          risks={risks}
          onSave={handleDialogSave}
          onCancel={handleDialogCancel}
        />

        <ConfirmDeleteDialog
          open={pendingDelete !== null}
          title="Delete item?"
          preview={pendingDelete?.text ?? ""}
          subtitle={
            pendingDelete ? `From ${pendingDelete.productName}` : undefined
          }
          onConfirm={confirmDelete}
          onCancel={clearPendingDelete}
        />

        <PauseReasonDialog
          open={pause.pending !== null}
          preview={pause.pending?.text ?? ""}
          initialReason={pause.pending?.pausedReason ?? ""}
          onConfirm={pause.confirm}
          onCancel={pause.cancel}
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
