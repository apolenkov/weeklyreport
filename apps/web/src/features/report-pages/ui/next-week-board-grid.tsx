"use client";

import type { ReactNode } from "react";

import type { CreateSeed } from "../../../hooks/use-editable-list-dialog";
import { responsiveBoardGridClassName } from "../../../shared/ui/layout/responsive-board-grid";
import type { ItemColumn, KanbanItem } from "../../report-sections";
import { ActivityLanesBlock, BoardColumnHeader } from "../../report-sections";

// Keeps an empty column as tall as a column holding a couple of item cards, so
// a board with a mix of empty and filled columns stays visually balanced.
const EMPTY_COLUMN_MIN_HEIGHT_PX = 150;

interface NextWeekBoardGridProps {
  readonly productColumns: readonly ItemColumn[];
  readonly activityLanes: readonly ItemColumn[];
  readonly readOnly: boolean;
  readonly hasMultipleProducts: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
  readonly renderItem: (item: KanbanItem) => ReactNode;
}

export function NextWeekBoardGrid({
  productColumns,
  activityLanes,
  readOnly,
  hasMultipleProducts,
  onAdd,
  renderItem,
}: NextWeekBoardGridProps) {
  return (
    <>
      <div className={responsiveBoardGridClassName(productColumns.length)}>
        {productColumns.map((col) => (
          <ProductColumn
            key={col.key}
            col={col}
            readOnly={readOnly}
            hasMultipleProducts={hasMultipleProducts}
            onAdd={onAdd}
            renderItem={renderItem}
          />
        ))}
      </div>

      <ActivityLanesBlock
        lanes={activityLanes}
        readOnly={readOnly}
        onAdd={onAdd}
        renderItem={renderItem}
      />
    </>
  );
}

interface ProductColumnProps {
  readonly col: ItemColumn;
  readonly readOnly: boolean;
  readonly hasMultipleProducts: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
  readonly renderItem: (item: KanbanItem) => ReactNode;
}

function ProductColumn({
  col,
  readOnly,
  hasMultipleProducts,
  onAdd,
  renderItem,
}: ProductColumnProps) {
  return (
    <div className="min-w-0">
      <BoardColumnHeader
        col={col}
        readOnly={readOnly}
        showProductAdd={hasMultipleProducts}
        onAdd={onAdd}
      />
      {col.items.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-[var(--card-surface-border)] bg-[var(--color-surface-empty)] p-3 text-center text-xs text-[var(--color-muted-foreground)]"
          style={{ minHeight: EMPTY_COLUMN_MIN_HEIGHT_PX }}
        >
          No items yet
        </div>
      ) : (
        <div className="space-y-2">{col.items.map(renderItem)}</div>
      )}
    </div>
  );
}
