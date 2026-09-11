import { Plus } from "lucide-react";

import type {
  StatusOverviewCreateTarget,
  StatusOverviewUnit,
} from "../model/status-overview";
import {
  editorLaneClass,
  idleTimelineLaneClass,
  type StatusOverviewEditorSlot,
} from "./status-overview-editor-slot";
import {
  STATUS_OVERVIEW_COLUMNS,
  type StatusOverviewColumnKey,
  TIMELINE_CELL,
  TIMELINE_GRID,
} from "./status-overview-layout";

export function TimelineFooter({
  unit,
  activeColumn,
  onAddItem,
  editorSlot,
}: {
  readonly unit: StatusOverviewUnit;
  readonly activeColumn: StatusOverviewColumnKey;
  readonly onAddItem?:
    ((target: StatusOverviewCreateTarget) => void) | undefined;
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
}) {
  const createSource =
    editorSlot?.recordId === null ? editorSlot.source : undefined;
  return (
    <div
      className={`${TIMELINE_GRID} border-t border-[var(--color-border-subtle)]`}
      data-testid="report-unit-footer"
    >
      {STATUS_OVERVIEW_COLUMNS.map((column) => {
        const matchesEditor = createSource === column.source;
        const layout = editorLaneClass(
          matchesEditor,
          createSource !== undefined,
          idleTimelineLaneClass(column.key === activeColumn),
        );
        return (
          <div
            key={column.key}
            data-overview-footer-lane={column.source}
            className={`${TIMELINE_CELL} ${layout}`}
          >
            {matchesEditor ? (
              editorSlot?.content
            ) : onAddItem &&
              !unit.historical &&
              column.source !== "previous" ? (
              <button
                type="button"
                aria-label={`Add ${column.source} week update to ${unit.name}`}
                data-overview-focus={`add:${unit.key}:${column.source}`}
                onClick={() =>
                  onAddItem({
                    source: column.source === "current" ? "current" : "next",
                    unitKind: unit.kind,
                    unitId: unit.id,
                  })
                }
                className="inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              >
                <Plus aria-hidden="true" className="size-4" />
                {column.source === "current"
                  ? "Add current update"
                  : "Plan next week"}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
