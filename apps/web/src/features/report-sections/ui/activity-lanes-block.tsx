"use client";

import type { ReactNode } from "react";

import type { CreateSeed } from "../../../hooks/use-editable-list-dialog";
import type { ItemColumn } from "../model/next-week-columns";
import type { KanbanItem } from "../model/types";
import { BoardColumnHeader } from "./board-column-header";

const MAX_LANE_COLUMNS = 3;

interface ActivityLanesBlockProps {
  readonly lanes: readonly ItemColumn[];
  readonly readOnly: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
  readonly renderItem: (item: KanbanItem) => ReactNode;
}

// Activities sit in a separate row under product cards (slide precedent), not
// as peer product columns; empty boards self-suppress via zero lanes.
/**
 * Activity Lanes Block.
 * @param props - The props argument.
 */
export function ActivityLanesBlock({
  lanes,
  readOnly,
  onAdd,
  renderItem,
}: ActivityLanesBlockProps) {
  if (lanes.length === 0) return null;

  return (
    <div className="mt-4 border-t border-dashed border-[rgba(0,0,0,0.12)] pt-3">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
        Activities
      </div>
      <div
        role="group"
        aria-label="Activity items"
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${Math.min(lanes.length, MAX_LANE_COLUMNS)}, minmax(0, 1fr))`,
        }}
      >
        {lanes.map((lane) => (
          <div
            key={lane.key}
            className="min-w-0 rounded-lg bg-[var(--color-surface-hover)] p-3"
          >
            <BoardColumnHeader
              col={lane}
              readOnly={readOnly}
              showProductAdd={false}
              onAdd={onAdd}
            />
            {lane.items.length === 0 ? (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-white/60 p-3 text-center text-xs text-[var(--color-muted-foreground)]">
                No items yet
              </div>
            ) : (
              <div className="space-y-2">{lane.items.map(renderItem)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
