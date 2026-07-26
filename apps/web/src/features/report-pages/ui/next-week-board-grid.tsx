"use client";

import type { ReactNode } from "react";

import type { CreateSeed } from "../../../hooks/use-editable-list-dialog";
import type { ItemColumn, KanbanItem } from "../../report-sections";
import { ActivityLanesBlock, BoardColumnHeader } from "../../report-sections";

const MAX_GRID_COLUMNS = 3;
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
  const visibleColumnCount = Math.min(
    Math.max(productColumns.length, 1),
    MAX_GRID_COLUMNS,
  );

  return (
    <>
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${visibleColumnCount}, minmax(0, 1fr))`,
        }}
      >
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
    <div>
      <BoardColumnHeader
        col={col}
        readOnly={readOnly}
        showProductAdd={hasMultipleProducts}
        onAdd={onAdd}
      />
      {col.items.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[var(--color-surface-hover)] p-3 text-center text-xs text-[var(--color-muted-foreground)]"
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
