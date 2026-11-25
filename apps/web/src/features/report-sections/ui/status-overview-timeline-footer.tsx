import { GrowingTextarea } from "@weeklyreport/ui/components/ui/growing-textarea";

import type {
  StatusOverviewCreateTarget,
  StatusOverviewRecordTarget,
  StatusOverviewUnit,
} from "../model/status-overview";
import { entryPlaceholder, overviewEntryLabel } from "./overview-entry-line";
import type {
  StatusOverviewEditorSlot,
  StatusOverviewRecordSlot,
} from "./status-overview-editor-slot";
import { TIMELINE_GRID } from "./status-overview-layout";

export function UnitEntryInput({
  unit,
  source,
  onAddItem,
  readOnly = false,
}: {
  readonly unit: StatusOverviewUnit;
  readonly source: "current" | "next";
  readonly onAddItem: (
    target: StatusOverviewCreateTarget,
    text: string,
  ) => void;
  readonly readOnly?: boolean;
}) {
  if (unit.historical) return null;
  const begin = (text: string) => {
    if (text && !readOnly)
      onAddItem({ source, unitKind: unit.kind, unitId: unit.id }, text);
  };
  return (
    <GrowingTextarea
      aria-label={overviewEntryLabel(unit.name, source)}
      placeholder={entryPlaceholder(source)}
      data-overview-focus={
        source === "current" ? `add:${unit.key}` : `add:${unit.key}:next`
      }
      readOnly={readOnly}
      onChange={(event) => {
        if (!(
          event.nativeEvent instanceof InputEvent &&
          event.nativeEvent.isComposing
        ))
          begin(event.currentTarget.value);
      }}
      onCompositionEnd={(event) => begin(event.currentTarget.value)}
      className="min-h-11 min-w-11 rounded-md bg-transparent px-2 py-1 text-sm focus-visible:ring-1 focus-visible:ring-ring"
    />
  );
}

export function StatusOverviewTimelineFooter({
  unit,
  onAddItem,
  editorSlot,
  recordSlot,
  ownedStageStarts,
}: {
  readonly unit: StatusOverviewUnit;
  readonly onAddItem?:
    ((target: StatusOverviewCreateTarget, text: string) => void) | undefined;
  readonly onAddRecord?:
    ((target: StatusOverviewRecordTarget) => void) | undefined;
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
  readonly recordSlot?: StatusOverviewRecordSlot | undefined;
  readonly ownedStageStarts?: readonly string[] | undefined;
}) {
  if (recordSlot?.unitKey === unit.key)
    return <div className="min-w-0 px-3 py-2">{recordSlot.content}</div>;
  const ineligible = unit.kind === "product" && ownedStageStarts?.length === 0;
  if ((!onAddItem || ineligible) && !editorSlot && !recordSlot)
    return (
      <div className={TIMELINE_GRID}>
        <div data-overview-create-lane="previous" />
        <div data-overview-create-lane="current">
          {unit.columns.currentWeek.items.length === 0 &&
            unit.columns.priorCommitments.items.length === 0 &&
            "No update this week."}
        </div>
        <div data-overview-create-lane="next">
          {unit.columns.nextWeek.items.length === 0 && "Nothing planned."}
        </div>
      </div>
    );
  if (unit.historical) return null;
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
                {!ineligible && (
                  <UnitEntryInput
                    unit={unit}
                    source={source}
                    onAddItem={onAddItem}
                    readOnly={editorSlot?.mode === "create"}
                  />
                )}
                {!ineligible &&
                  source === "current" &&
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
