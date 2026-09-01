"use client";
import type { ReactNode } from "react";

import type { CreateSeed } from "../../../shared/hooks/dialogs/editable-list-dialog.types";
import {
  BoardGrid,
  type ItemColumn,
  type KanbanItem,
} from "../../report-sections";
export interface CurrentWeekBoardGridProps {
  readonly productColumns: readonly ItemColumn[];
  readonly activityLanes: readonly ItemColumn[];
  readonly readOnly: boolean;
  readonly hasMultipleProducts: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
  readonly renderItem: (item: KanbanItem) => ReactNode;
}
export function CurrentWeekBoardGrid(props: CurrentWeekBoardGridProps) {
  return <BoardGrid {...props} />;
}
