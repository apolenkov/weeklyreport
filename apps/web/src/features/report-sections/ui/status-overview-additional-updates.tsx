import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import type { StatusOverviewLineageRow } from "../model/status-overview-lineage";
import { isLinkedOverviewRow } from "../model/status-overview-lineage";
import {
  editorLaneClass,
  editorSlotMatchesItem,
  idleTimelineLaneClass,
  type StatusOverviewEditorSlot,
} from "./status-overview-editor-slot";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";

export const REPORT_PREVIEW_COUNT = 2;

export function additionalItems(
  rows: readonly StatusOverviewLineageRow[],
  source: "current" | "next",
): StatusOverviewItem[] {
  return rows.flatMap((row) =>
    !isLinkedOverviewRow(row) && row[source] ? [row[source]] : [],
  );
}

// The two-preview cap is per temporal column: linked lineage cells plus the
// independent "additional updates" share the same budget, so a mixed unit never
// shows more than two previews in one column.
export function previewBudget(rows: readonly StatusOverviewLineageRow[]): {
  readonly current: number;
  readonly next: number;
  readonly hiddenLinked: number;
} {
  const linked = rows.filter(isLinkedOverviewRow);
  const visibleLinked = linked.slice(0, REPORT_PREVIEW_COUNT);
  const linkedCurrent = visibleLinked.filter(
    (row) => row.current !== null,
  ).length;
  const linkedNext = visibleLinked.filter((row) => row.next !== null).length;
  return {
    current: Math.max(0, REPORT_PREVIEW_COUNT - linkedCurrent),
    next: Math.max(0, REPORT_PREVIEW_COUNT - linkedNext),
    hiddenLinked: Math.max(0, linked.length - REPORT_PREVIEW_COUNT),
  };
}

export function reportHiddenRowCount(
  rows: readonly StatusOverviewLineageRow[],
): number {
  const budget = previewBudget(rows);
  return (
    budget.hiddenLinked +
    Math.max(0, additionalItems(rows, "current").length - budget.current) +
    Math.max(0, additionalItems(rows, "next").length - budget.next)
  );
}

export function StatusOverviewAdditionalUpdates({
  rows,
  expanded,
  activeColumn,
  onEditItem,
  onResolvePlan,
  onRestorePlan,
  editorSlot,
}: {
  readonly rows: readonly StatusOverviewLineageRow[];
  readonly expanded: boolean;
  readonly activeColumn: "previouslyPlanned" | "currentWeek" | "nextWeek";
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onResolvePlan?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onRestorePlan?: ((item: StatusOverviewItem) => void) | undefined;
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
}) {
  if (rows.every(isLinkedOverviewRow)) return null;
  const budget = previewBudget(rows);
  const itemsBySource = {
    current: additionalItems(rows, "current"),
    next: additionalItems(rows, "next"),
  } as const;
  const matchedSource = (["current", "next"] as const).find((source) =>
    itemsBySource[source].some((item) =>
      editorSlotMatchesItem(editorSlot, item),
    ),
  );
  return (
    <div
      aria-label="Updates without a linked prior plan"
      className="md:grid md:grid-cols-3"
    >
      <div
        className={`${matchedSource ? "hidden" : "hidden md:block"} min-w-0 px-4 py-3`}
      >
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Additional updates
        </p>
      </div>
      {(["current", "next"] as const).map((source) => {
        const items = itemsBySource[source];
        const visible =
          activeColumn === (source === "current" ? "currentWeek" : "nextWeek");
        const matchesEditor = matchedSource === source;
        const visibleCount =
          source === "current" ? budget.current : budget.next;
        const layout = editorLaneClass(
          matchesEditor,
          matchedSource !== undefined,
          idleTimelineLaneClass(visible),
        );
        const label =
          source === "current"
            ? "Current updates without a prior plan"
            : "Next updates without a prior plan";
        return (
          <div
            key={source}
            data-overview-additional-lane={source}
            className={`${layout} min-w-0 md:border-l md:border-[var(--color-border-subtle)]`}
          >
            {items.length > 0 ? (
              <p className="px-4 pt-3 text-xs font-medium text-[var(--color-muted-foreground)]">
                {label}
              </p>
            ) : null}
            <ul
              aria-label={`Additional ${source} updates`}
              className="min-w-0 divide-y divide-[var(--color-border-subtle)]"
            >
              {items.map((item, index) => (
                <li
                  key={item.stableId ?? item.key}
                  hidden={index >= visibleCount && !expanded}
                  inert={index >= visibleCount && !expanded}
                  className="min-w-0 px-4 py-3"
                >
                  <ReportItemSlot
                    item={item}
                    editorSlot={editorSlot}
                    onEditItem={onEditItem}
                    onResolvePlan={onResolvePlan}
                    onRestorePlan={onRestorePlan}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function ReportItemSlot({
  item,
  editorSlot,
  onEditItem,
  onResolvePlan,
  onRestorePlan,
}: {
  readonly item: StatusOverviewItem;
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onResolvePlan?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onRestorePlan?: ((item: StatusOverviewItem) => void) | undefined;
}) {
  const matches = editorSlotMatchesItem(editorSlot, item);
  return (
    <div className="min-w-0">
      {matches && editorSlot ? (
        editorSlot.content
      ) : (
        <StatusOverviewItemPreview
          item={item}
          onEditItem={onEditItem}
          onResolvePlan={onResolvePlan}
          onRestorePlan={onRestorePlan}
        />
      )}
    </div>
  );
}
