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
      <span>{source === "current" ? "What happened…" : "Plan…"}</span>
    </button>
  );
}

export function StatusOverviewTimelineFooter({
  unit,
  onAddItem,
  onAddRecord,
  editorSlot,
  recordSlot,
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
  if (recordSlot?.unitKey === unit.key)
    return <div className="min-w-0 px-3 py-2">{recordSlot.content}</div>;
  if (!onAddItem && !onAddRecord) return <div className={TIMELINE_GRID}><div data-overview-create-lane="previous"/><div data-overview-create-lane="current">{unit.columns.currentWeek.items.length===0 && unit.columns.priorCommitments.items.length===0 && "No update this week."}</div><div data-overview-create-lane="next">{unit.columns.nextWeek.items.length===0 && "Nothing planned."}</div></div>;
  if (unit.historical)return null;
  return (
    <div className={TIMELINE_GRID}>
      <div data-overview-create-lane="previous" />
      {onAddItem &&
        (["current", "next"] as const).map((source) => (
          <div
            key={source}
            data-overview-create-lane={source}
            className="min-w-0 px-3 md:border-l md:border-[var(--color-border-subtle)]"
          >
            {editorSlot?.mode === "create" &&
            editorSlot.unitKey === unit.key &&
            editorSlot.source === source ? (
              editorSlot.content
            ) : (
              <>
                <UnitAddItemButton
                  unit={unit}
                  source={source}
                  onAddItem={onAddItem}
                />
                {source === "current" &&
                  unit.kind === "product" &&
                  unit.columns.currentWeek.items.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      needed to submit
                    </span>
                  )}
              </>
            )}
          </div>
        ))}
    </div>
  );
}
