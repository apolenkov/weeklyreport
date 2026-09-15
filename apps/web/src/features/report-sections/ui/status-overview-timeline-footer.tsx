import { Plus } from "lucide-react";

import type {
  StatusOverviewCreateTarget,
  StatusOverviewUnit,
} from "../model/status-overview";
import type { StatusOverviewEditorSlot } from "./status-overview-editor-slot";

export function TimelineFooter({
  unit,
  onAddItem,
  editorSlot,
}: {
  readonly unit: StatusOverviewUnit;
  readonly onAddItem?:
    ((target: StatusOverviewCreateTarget) => void) | undefined;
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
}) {
  const createEditor = editorSlot?.mode === "create" ? editorSlot : undefined;
  return (
    <div
      className="border-t border-[var(--color-border-subtle)] px-4 py-3"
      data-testid="report-unit-footer"
    >
      {createEditor ? (
        createEditor.content
      ) : onAddItem && !unit.historical ? (
        <button
          type="button"
          aria-label={`Add item to ${unit.name}`}
          data-overview-focus={`add:${unit.key}`}
          onClick={() =>
            onAddItem({
              source: "current",
              unitKind: unit.kind,
              unitId: unit.id,
            })
          }
          className="inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add item
        </button>
      ) : null}
    </div>
  );
}
