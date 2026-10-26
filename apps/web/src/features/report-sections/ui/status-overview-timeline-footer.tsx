import { Plus } from "lucide-react";

import type {
  StatusOverviewCreateTarget,
  StatusOverviewUnit,
} from "../model/status-overview";
import type { StatusOverviewEditorSlot } from "./status-overview-editor-slot";

// Every creation entry point is the same button contract: the unit header, the
// timeline lanes and the mobile header all emit one canonical create target so
// they share the single composer and never a second draft store.
const CREATE_CONTROL =
  "min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

// Desktop lanes reveal their create control on pointer hover or keyboard focus
// within the lane, and keep it visible where hover cannot exist (touch). The
// node always stays in the accessibility tree; only sight is hidden. Mobile
// creation lives in the unit header instead, because empty lanes stay collapsed.
const CELL_CREATE_REVEAL =
  "hidden md:inline-flex opacity-0 transition-opacity group-hover/lane:opacity-100 group-focus-within/lane:opacity-100 [@media(hover=none)]:opacity-100 motion-reduce:transition-none";

type CreateSource = "current" | "next";

function createTarget(
  unit: StatusOverviewUnit,
  source: CreateSource,
): StatusOverviewCreateTarget {
  return { source, unitKind: unit.kind, unitId: unit.id };
}

function weekLabel(source: CreateSource): string {
  return source === "current" ? "current week" : "next week";
}

// The accessible name identifies creation, unit and week for every origin.
function createLabel(unit: StatusOverviewUnit, source: CreateSource): string {
  return `Add ${weekLabel(source)} update to ${unit.name}`;
}

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
      onClick={() => onAddItem(createTarget(unit, "current"))}
      className={`inline-flex ${CREATE_CONTROL}`}
    >
      <Plus aria-hidden="true" className="size-4" />
    </button>
  );
}

// Mobile overview collapses empty lanes, so the unit header owns always-visible
// Current and Next creation for every unit, including an entirely empty one.
export function UnitWeekCreateControls({
  unit,
  onAddItem,
}: {
  readonly unit: StatusOverviewUnit;
  readonly onAddItem: (target: StatusOverviewCreateTarget) => void;
}) {
  if (unit.historical) return null;
  return (
    <div
      className="flex items-center gap-1 md:hidden"
      data-overview-mobile-create={unit.key}
    >
      {(["current", "next"] as const).map((source) => (
        <button
          key={source}
          type="button"
          aria-label={createLabel(unit, source)}
          title={`Add ${weekLabel(source)} update`}
          data-overview-create-origin="mobile-header"
          data-overview-create-source={source}
          data-overview-focus={`add:${unit.key}:mobile:${source}`}
          onClick={() => onAddItem(createTarget(unit, source))}
          className={`inline-flex ${CREATE_CONTROL}`}
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      ))}
    </div>
  );
}

// Contextual desktop creation in one Current or Next lane. The row key keeps
// focus restoration exact when several rows of one unit share a week.
export function CellCreateButton({
  unit,
  source,
  rowKey,
  onAddItem,
}: {
  readonly unit: StatusOverviewUnit;
  readonly source: CreateSource;
  readonly rowKey: string;
  readonly onAddItem: (target: StatusOverviewCreateTarget) => void;
}) {
  return (
    <button
      type="button"
      aria-label={createLabel(unit, source)}
      title={`Add ${weekLabel(source)} update`}
      data-overview-create-origin="cell"
      data-overview-create-source={source}
      data-overview-focus={`add:${unit.key}:row:${rowKey}:cell:${source}`}
      onClick={() => onAddItem(createTarget(unit, source))}
      className={`${CREATE_CONTROL} ${CELL_CREATE_REVEAL}`}
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
