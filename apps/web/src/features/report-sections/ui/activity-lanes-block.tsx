"use client";

import type { ReactNode } from "react";

import type { CreateSeed } from "../../../hooks/use-editable-list-dialog";
import { responsiveBoardGridClassName } from "../../../shared/ui/responsive-board-grid";
import type { ItemColumn } from "../model/next-week-columns";
import type { KanbanItem } from "../model/types";
import { BoardColumnHeader } from "./board-column-header";

interface ActivityLanesBlockProps {
  readonly lanes: readonly ItemColumn[];
  readonly readOnly: boolean;
  readonly onAdd: (seed: CreateSeed) => void;
  readonly renderItem: (item: KanbanItem) => ReactNode;
}

// Activities sit in a separate row under product cards (slide precedent), not
// as peer product columns; empty boards self-suppress via zero lanes.
export function ActivityLanesBlock({
  lanes,
  readOnly,
  onAdd,
  renderItem,
}: ActivityLanesBlockProps) {
  if (lanes.length === 0) return null;

  return (
    <div className="mt-4 border-t border-dashed border-[var(--card-surface-border)] pt-3">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
        Activities
      </div>
      <div
        role="group"
        aria-label="Activity items"
        className={responsiveBoardGridClassName(lanes.length)}
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
              <div className="flex items-center justify-center rounded-lg border border-dashed border-[var(--card-surface-border)] bg-[color-mix(in_srgb,var(--color-card)_60%,transparent)] p-3 text-center text-xs text-[var(--color-muted-foreground)]">
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
