"use client";

import type { ReactNode } from "react";

import type { CreateSeed } from "../../hooks/use-editable-list-dialog";
import { BoardColumnHeader } from "./board-column-header";
import type { KanbanItem } from "./mock-data";
import type { ItemColumn } from "./next-week-columns";

const MAX_LANE_COLUMNS = 3;

interface ActivityLanesBlockProps {
  /** Lanes from `splitItemBoard` — one per activity that owns rows. */
  readonly lanes: readonly ItemColumn[];
  readonly readOnly: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
  /** Host-section card render, so Current/Next keep their own item actions. */
  readonly renderItem: (item: KanbanItem) => ReactNode;
}

/**
 * The week boards' activity level, rendered BELOW the product grid as its own
 * lighter block (the slide precedent: activities are a separate row under the
 * product cards, never peer product columns). A lane exists only when it has
 * rows, so the block self-suppresses on activity-less boards; each lane header
 * carries the activity-preselecting "+ Add".
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
            <div className="space-y-2">{lane.items.map(renderItem)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
