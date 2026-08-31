"use client";

import type { ReactNode } from "react";

import type { CreateSeed } from "../../../shared/hooks/dialogs/use-editable-list-dialog";
import { responsiveBoardGridClassName } from "../../../shared/ui/layout/responsive-board-grid";
import type { ItemColumn } from "../model/next-week-columns";
import type { KanbanItem } from "../model/types";
import { ActivityLanesBlock } from "./activity-lanes-block";
import { BoardColumnHeader } from "./board-column-header";

export interface BoardGridProps {
  readonly productColumns: readonly ItemColumn[];
  readonly activityLanes: readonly ItemColumn[];
  readonly readOnly: boolean;
  readonly hasMultipleProducts: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
  readonly renderItem: (item: KanbanItem) => ReactNode;
}

export function BoardGrid(props: BoardGridProps) {
  return (
    <>
      <div
        className={responsiveBoardGridClassName(props.productColumns.length)}
      >
        {props.productColumns.map((col) => (
          <div key={col.key} className="min-w-0">
            <BoardColumnHeader
              col={col}
              readOnly={props.readOnly}
              showProductAdd={props.hasMultipleProducts}
              onAdd={props.onAdd}
            />
            {col.items.length === 0 ? (
              <div
                className="flex items-center justify-center rounded-lg border border-dashed border-[var(--card-surface-border)] bg-[var(--color-surface-empty)] p-3 text-center text-xs text-[var(--color-muted-foreground)]"
                style={{ minHeight: 150 }}
              >
                No items yet
              </div>
            ) : (
              <div className="space-y-2">{col.items.map(props.renderItem)}</div>
            )}
          </div>
        ))}
      </div>
      <ActivityLanesBlock
        lanes={props.activityLanes}
        readOnly={props.readOnly}
        onAdd={props.onAdd}
        renderItem={props.renderItem}
      />
    </>
  );
}
