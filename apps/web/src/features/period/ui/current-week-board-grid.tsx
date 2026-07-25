"use client";

import type { ReactNode } from "react";

import type { CreateSeed } from "../../../hooks/use-editable-list-dialog";
import type { ItemColumn, KanbanItem } from "../../report-sections";
import { ActivityLanesBlock, BoardColumnHeader } from "../../report-sections";

const MAX_GRID_COLUMNS = 3;

interface CurrentWeekBoardGridProps {
  readonly productColumns: readonly ItemColumn[];
  readonly activityLanes: readonly ItemColumn[];
  readonly readOnly: boolean;
  readonly hasMultipleProducts: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
  readonly renderItem: (item: KanbanItem) => ReactNode;
}

export function CurrentWeekBoardGrid({
  productColumns,
  activityLanes,
  readOnly,
  hasMultipleProducts,
  onAdd,
  renderItem,
}: CurrentWeekBoardGridProps) {
  return (
    <>
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${Math.min(Math.max(productColumns.length, 1), MAX_GRID_COLUMNS)}, minmax(0, 1fr))`,
        }}
      >
        {productColumns.map((col) => (
          <div key={col.key} className="min-w-0">
            <BoardColumnHeader
              col={col}
              readOnly={readOnly}
              showProductAdd={hasMultipleProducts}
              onAdd={onAdd}
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
        lanes={activityLanes}
        readOnly={readOnly}
        onAdd={onAdd}
        renderItem={renderItem}
      />
    </>
  );
}
