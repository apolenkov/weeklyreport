"use client";

import { useEditableListDialog } from "../../../hooks/use-editable-list-dialog";
import {
  isBoardEmpty,
  ItemCard,
  type KanbanItem,
  type Product,
  type RiskEntry,
  splitItemBoard,
} from "../../report-sections";
import { NextWeekBoardGrid } from "./next-week-board-grid";
import { NextWeekDialogs } from "./next-week-dialogs";

interface NextWeekSectionProps {
  readonly items: KanbanItem[];
  // Own risks for ItemCard alarm derivation (in-progress only; planned never floors).
  readonly risks?: readonly RiskEntry[];
  readonly readOnly?: boolean;
  // Parent merges into draftSection.items by id, preserving non-presentation fields.
  readonly onItemsChange?: (items: KanbanItem[]) => void;
  readonly currentUserName?: string;
  readonly products?: readonly Product[];
  readonly activities?: readonly { id: string; name: string }[];
  readonly stagesForProduct?: (productId: string) => readonly string[];
  // Full-period ranks so ItemEditDialog can disable taken priority ranks.
  readonly ownPeriodRanks?: readonly number[];
  readonly addSignal?: number;
  // Resolve-not-delete (ADR 0015): published-lineage ids show marker, hide Delete.
  readonly publishedLockedIds?: ReadonlySet<string>;
  readonly onMoveToCurrentWeek?: (id: string) => void;
}

export function NextWeekSection({
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
  onMoveToCurrentWeek,
}: NextWeekSectionProps) {
  const isEmpty = isBoardEmpty(items, products, activities);
  const hasProducts = products && products.length > 0;
  const hasMultipleProducts = hasProducts && products.length > 1;
  const defaultProduct = products?.[0];
  const defaultProductId = defaultProduct?.id;

  // The shared lifecycle ignores add signals while read-only and remounts the
  // dialog for each open. This section requires a product column for create mode.
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
    seedProductId: defaultProductId,
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

  // Empty-state mirror of CurrentWeekSection: when no items exist we
  // surface a stand-alone CTA seeded from the first product, otherwise
  // the section ends up dead with no way to start filling it.
  if (isEmpty) {
    if (readOnly) {
      return (
        <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No next-week items.
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-8 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No next-week items yet.
        </p>
        {globalAddButton}
      </div>
    );
  }

  // Activity lanes render in their own lighter block BELOW the grid — never
  // as peer product columns.
  const board = splitItemBoard(products, items, activities);

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
      onMoveToCurrentWeek={onMoveToCurrentWeek}
    />
  );

  const editItem =
    dialogState.open && dialogState.mode === "edit" ? dialogState.entity : null;
  const createSeedProductId =
    dialogState.open && dialogState.mode === "create"
      ? dialogState.seedProductId
      : undefined;
  const createSeedActivityId =
    dialogState.open && dialogState.mode === "create"
      ? dialogState.seedActivityId
      : undefined;

  return (
    <div
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard-focusable (axe scrollable-region-focusable); the static rule does not model that WCAG exception
      tabIndex={0}
      role="group"
      aria-label="Next week items"
      className="max-h-[420px] overflow-y-auto"
      style={{ scrollbarWidth: "thin" }}
    >
      <NextWeekBoardGrid
        productColumns={board.productColumns}
        activityLanes={board.activityLanes}
        readOnly={readOnly}
        hasMultipleProducts={hasMultipleProducts === true}
        onAdd={openCreate}
        renderItem={renderItem}
      />

      <NextWeekDialogs
        dialogKey={dialogKey}
        open={dialogState.open}
        editItem={editItem}
        products={products ?? []}
        activities={activities}
        currentUserName={currentUserName}
        createSeedProductId={createSeedProductId}
        createSeedActivityId={createSeedActivityId}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        risks={risks}
        onSave={handleDialogSave}
        onCancel={handleDialogCancel}
        pendingDelete={pendingDelete}
        onConfirmDelete={confirmDelete}
        onCancelDelete={clearPendingDelete}
      />
    </div>
  );
}
