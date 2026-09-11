"use client";

import { createEditableListHandlers } from "../../../../shared/hooks/dialogs/create-editable-list-handlers";
import { useEditableListDialog } from "../../../../shared/hooks/dialogs/use-editable-list-dialog";
import { buildItemDialogProps } from "../../model/item-dialog-props";
import type { NextWeekSectionProps } from "../../model/next-week/next-week-section.types";
import { isBoardEmpty, splitItemBoard } from "../../model/next-week-columns";
import type { KanbanItem, Product } from "../../model/types";
import { BoardEmptyState } from "../board-empty-state";
import { BoardGrid } from "../board-grid";
import { ItemCard } from "../item-card";
import { ItemDialogStack } from "../item-dialog-stack";
type NextWeekItemHandlers = ReturnType<
  typeof createEditableListHandlers<KanbanItem>
>;

// Stand-alone CTA seeded from the first product. Disabled (with an explanatory
// title) for a lead who owns no product, since an item needs a product column.
function AddItemButton({
  defaultProduct,
  onAdd,
}: {
  readonly defaultProduct: Product | undefined;
  readonly onAdd: (seed: { productId: string }) => void;
}) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() =>
          defaultProduct && onAdd({ productId: defaultProduct.id })
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
}

// Bind a card renderer to this section's props; the grid calls it per item.
function createItemRenderer({
  props,
  handlers,
}: {
  readonly props: NextWeekSectionProps;
  readonly handlers: NextWeekItemHandlers;
}) {
  return (item: KanbanItem) => (
    <ItemCard
      key={item.id}
      item={item}
      risks={props.risks}
      readOnly={props.readOnly ?? false}
      publishedLocked={props.publishedLockedIds?.has(item.id)}
      onEdit={handlers.handleEdit}
      onDelete={handlers.handleDelete}
      onMoveToCurrentWeek={props.onMoveToCurrentWeek}
    />
  );
}

export function NextWeekSection(props: NextWeekSectionProps) {
  const { items, products, activities } = props;
  const { readOnly = false, addSignal = 0 } = props;
  const defaultProduct = products[0];
  const defaultActivityId = defaultProduct ? undefined : activities?.[0]?.id;

  // The shared lifecycle ignores add signals while read-only and remounts the
  // dialog for each open. This section requires a product column for create mode.
  const dialog = useEditableListDialog<KanbanItem>({
    readOnly,
    addSignal,
    seedProductId: defaultProduct?.id,
    seedActivityId: defaultActivityId,
    requireSeed: true,
  });

  const handlers = createEditableListHandlers(props, dialog);

  if (isBoardEmpty(items, products, activities)) {
    return (
      <BoardEmptyState
        readOnly={readOnly}
        readOnlyLabel="No next-week items."
        editableLabel="No next-week items yet."
        addButton={
          <AddItemButton
            defaultProduct={defaultProduct}
            onAdd={dialog.openCreate}
          />
        }
      />
    );
  }

  // Activity lanes render in their own lighter block BELOW the grid — never
  // as peer product columns.
  const board = splitItemBoard(products, items, activities);

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Next week items"
      className="max-md:max-h-none max-md:overflow-visible md:max-h-[420px] md:overflow-y-auto"
      style={{ scrollbarWidth: "thin" }}
    >
      <BoardGrid
        productColumns={board.productColumns}
        activityLanes={board.activityLanes}
        readOnly={readOnly}
        hasMultipleProducts={products.length > 1}
        onAdd={dialog.openCreate}
        renderItem={createItemRenderer({ props, handlers })}
      />

      <ItemDialogStack
        {...buildItemDialogProps({
          section: props,
          dialog,
          handlers,
          week: "next",
        })}
      />
    </div>
  );
}
