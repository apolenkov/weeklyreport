"use client";
import type { ReactNode } from "react";

import type { CreateSeed } from "../../../../shared/hooks/dialogs/use-editable-list-dialog";
import type { ItemColumn } from "../../model/next-week-columns";
import type { KanbanItem } from "../../model/types";
import { BoardGrid } from "../board-grid";
export interface NextWeekBoardGridProps {
  readonly productColumns: readonly ItemColumn[];
  readonly activityLanes: readonly ItemColumn[];
  readonly readOnly: boolean;
  readonly hasMultipleProducts: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
  readonly renderItem: (item: KanbanItem) => ReactNode;
}
export function NextWeekBoardGrid(props: NextWeekBoardGridProps) {
  return <BoardGrid {...props} />;
}
