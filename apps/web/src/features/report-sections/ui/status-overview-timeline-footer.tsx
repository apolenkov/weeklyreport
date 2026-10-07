import { Plus } from "lucide-react";

import type {
  StatusOverviewCreateTarget,
  StatusOverviewUnit,
} from "../model/status-overview";
import type { StatusOverviewEditorSlot } from "./status-overview-editor-slot";

// The unit-level add affordance lives in the unit header; the footer strip is
// kept only as the create-composer host so the editor still spans the timeline.
export function UnitAddItemButton({
  unit,
  onAddItem,
}: {
  readonly unit: StatusOverviewUnit;
  readonly onAddItem: (target: StatusOverviewCreateTarget) => void;
}) {
  if (unit.historical) return null;
  return (
    <button
      type="button"
      aria-label={`Add item to ${unit.name}`}
      title="Add item"
      data-overview-focus={`add:${unit.key}`}
      onClick={() =>
        onAddItem({
          source: "current",
          unitKind: unit.kind,
          unitId: unit.id,
        })
      }
      className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      <Plus aria-hidden="true" className="size-4" />
    </button>
  );
}

export function TimelineFooter({
  editorSlot,
}: {
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
}) {
  const createEditor = editorSlot?.mode === "create" ? editorSlot : undefined;
  if (!createEditor) return null;
  return (
    <div
      className="border-t border-[var(--color-border-subtle)] px-4 py-3"
      data-testid="report-unit-footer"
    >
      {createEditor.content}
    </div>
  );
}
