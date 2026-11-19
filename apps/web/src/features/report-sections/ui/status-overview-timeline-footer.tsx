import { Plus } from "lucide-react";

import type {
  StatusOverviewCreateTarget,
  StatusOverviewRecordTarget,
  StatusOverviewUnit,
} from "../model/status-overview";
import type {
  StatusOverviewEditorSlot,
  StatusOverviewRecordSlot,
} from "./status-overview-editor-slot";
import { TIMELINE_GRID } from "./status-overview-layout";

export function UnitAddItemButton({
  unit,
  source,
  onAddItem,
}: {
  readonly unit: StatusOverviewUnit;
  readonly source: "current" | "next";
  readonly onAddItem: (target: StatusOverviewCreateTarget) => void;
}) {
  if (unit.historical) return null;
  const week = source === "current" ? "Current week" : "Next week";
  return (
    <button
      type="button"
      aria-label={`Add item to ${unit.name}, ${week}`}
      data-overview-focus={
        source === "current" ? `add:${unit.key}` : `add:${unit.key}:next`
      }
      onClick={() =>
        onAddItem({ source, unitKind: unit.kind, unitId: unit.id })
      }
      className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center gap-1 rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]"
    >
      <Plus aria-hidden="true" className="size-4" />
      <span>
        Add item <span className="md:hidden">· {week}</span>
      </span>
    </button>
  );
}

// A bare stage name reads as a tag, not an action: the lead-in says what the
// names do, and each one carries the same plus mark as "Add item".
function StageStarts({
  unit,
  source,
  stageNames,
  onAddItem,
}: {
  readonly unit: StatusOverviewUnit;
  readonly source: "current" | "next";
  readonly stageNames: readonly string[];
  readonly onAddItem: (target: StatusOverviewCreateTarget) => void;
}) {
  const week = source === "current" ? "Current week" : "Next week";
  return (
    <div className="flex flex-wrap items-center gap-x-0.5 pl-2">
      <span className="text-xs text-[var(--color-muted-foreground)]">
        Or start in a stage:
      </span>
      {stageNames.map((stageName) => (
        <button
          key={stageName}
          type="button"
          data-overview-focus={`add-stage:${unit.key}:${source}:${stageName}`}
          aria-label={`Add item to ${unit.name}, ${stageName}, ${week}`}
          title={`Add item in ${stageName}`}
          onClick={() =>
            onAddItem({
              source,
              unitKind: "product",
              unitId: unit.id,
              stageName,
            })
          }
          className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center gap-0.5 rounded-[var(--radius-sm)] px-1.5 text-sm text-[var(--color-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {stageName}
        </button>
      ))}
    </div>
  );
}

const RECORD_STARTS = [
  { kind: "risk", label: "Risk" },
  { kind: "decision", label: "Decision" },
] as const;

// A risk or decision is raised from its Product or Activity, without a week lane.
function UnitRecordStarts({
  unit,
  onAddRecord,
}: {
  readonly unit: StatusOverviewUnit;
  readonly onAddRecord: (target: StatusOverviewRecordTarget) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-0.5">
      {RECORD_STARTS.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          data-overview-focus={`add-${kind}:${unit.key}`}
          aria-label={`Add ${kind} to ${unit.name}`}
          onClick={() =>
            onAddRecord({ kind, unitKind: unit.kind, unitId: unit.id })
          }
          className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center gap-1 rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]"
        >
          <Plus aria-hidden="true" className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function StatusOverviewTimelineFooter({
  unit,
  onAddItem,
  onAddRecord,
  editorSlot,
  recordSlot,
  ownedStageStarts,
}: {
  readonly unit: StatusOverviewUnit;
  readonly onAddItem?:
    ((target: StatusOverviewCreateTarget) => void) | undefined;
  readonly onAddRecord?:
    ((target: StatusOverviewRecordTarget) => void) | undefined;
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
  readonly recordSlot?: StatusOverviewRecordSlot | undefined;
  readonly ownedStageStarts?: readonly string[] | undefined;
}) {
  if (unit.historical) return null;
  if (recordSlot?.unitKey === unit.key)
    return <div className="min-w-0 px-3 py-2">{recordSlot.content}</div>;
  if (!onAddItem && !onAddRecord) return null;
  return (
    <div className={TIMELINE_GRID}>
      <div className={onAddRecord ? "min-w-0 px-3" : "max-md:hidden"}>
        {onAddRecord ? (
          <UnitRecordStarts unit={unit} onAddRecord={onAddRecord} />
        ) : null}
      </div>
      {onAddItem &&
        (["current", "next"] as const).map((source) => (
          <div
            key={source}
            data-overview-create-lane={source}
            className="min-w-0 px-3 md:border-l md:border-[var(--color-border-subtle)]"
          >
            <UnitAddItemButton
              unit={unit}
              source={source}
              onAddItem={onAddItem}
            />
            {unit.kind === "product" && ownedStageStarts?.length ? (
              <StageStarts
                unit={unit}
                source={source}
                stageNames={ownedStageStarts}
                onAddItem={onAddItem}
              />
            ) : null}
            {editorSlot?.mode === "create" &&
            editorSlot.unitKey === unit.key &&
            editorSlot.source === source
              ? editorSlot.content
              : null}
          </div>
        ))}
    </div>
  );
}
