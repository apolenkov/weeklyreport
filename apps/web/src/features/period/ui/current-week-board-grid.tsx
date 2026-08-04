"use client";

import type { ReactNode } from "react";

import type { CreateSeed } from "../../../hooks/use-editable-list-dialog";
import { responsiveBoardGridClassName } from "../../../shared/ui/responsive-board-grid";
import type { ItemColumn, KanbanItem } from "../../report-sections";
import { ActivityLanesBlock, BoardColumnHeader } from "../../report-sections";

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
      <div className={responsiveBoardGridClassName(productColumns.length)}>
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
                className="flex items-center justify-center rounded-lg border border-dashed border-[var(--card-surface-border)] bg-[var(--color-surface-empty)] p-3 text-center text-xs text-[var(--color-muted-foreground)]"
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
