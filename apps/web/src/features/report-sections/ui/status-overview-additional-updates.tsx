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

export function reportHiddenRowCount(
  rows: readonly StatusOverviewLineageRow[],
): number {
  const counts = [
    rows.filter(isLinkedOverviewRow).length,
    additionalItems(rows, "current").length,
    additionalItems(rows, "next").length,
  ];
  return counts.reduce(
    (total, count) => total + Math.max(0, count - REPORT_PREVIEW_COUNT),
    0,
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
                  hidden={index >= REPORT_PREVIEW_COUNT && !expanded}
                  inert={index >= REPORT_PREVIEW_COUNT && !expanded}
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
