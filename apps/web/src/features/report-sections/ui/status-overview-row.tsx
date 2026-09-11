import type { ReportHealthUnit } from "../model/report-health-pulse";
import type {
  StatusOverviewCreateTarget,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewModel,
  StatusOverviewUnit,
} from "../model/status-overview";
import type { StatusOverviewLineageRow } from "../model/status-overview-lineage";
import { isLinkedOverviewRow } from "../model/status-overview-lineage";
import {
  type OpenHealthDetail,
  ReportHealthDetail,
} from "./report-health-pulse";
import {
  REPORT_PREVIEW_COUNT,
  reportHiddenRowCount,
  ReportItemSlot,
  StatusOverviewAdditionalUpdates,
} from "./status-overview-additional-updates";
import {
  editorLaneClass,
  editorSlotMatchesItem,
  idleTimelineLaneClass,
  type StatusOverviewEditorSlot,
} from "./status-overview-editor-slot";
import {
  STATUS_OVERVIEW_COLUMNS,
  STATUS_OVERVIEW_DESKTOP_GRID,
  type StatusOverviewColumnKey,
  TIMELINE_CELL as CELL,
  TIMELINE_GRID,
} from "./status-overview-layout";
import { StatusOverviewUnitSummary } from "./status-overview-summary";
import { TimelineFooter } from "./status-overview-timeline-footer";

export { STATUS_OVERVIEW_COLUMNS, STATUS_OVERVIEW_DESKTOP_GRID };
export type { StatusOverviewColumnKey };

interface ItemHandlers {
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onQuickEditText?:
    ((item: StatusOverviewItem, text: string) => void) | undefined;
  readonly onAddItem?:
    ((target: StatusOverviewCreateTarget) => void) | undefined;
  readonly onResolvePlan?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onRestorePlan?: ((item: StatusOverviewItem) => void) | undefined;
}

function LineageRow({
  row,
  activeColumn,
  onEditItem,
  onQuickEditText,
  onResolvePlan,
  onRestorePlan,
  editorSlot,
}: {
  readonly row: StatusOverviewLineageRow;
  readonly activeColumn: StatusOverviewColumnKey;
} & Pick<
  ItemHandlers,
  | "onEditItem"
  | "onQuickEditText"
  | "onResolvePlan"
  | "onRestorePlan"
  | "editorSlot"
>) {
  const selected = STATUS_OVERVIEW_COLUMNS.find(
    (column) => column.key === activeColumn,
  );
  const hasVisibleContent = selected ? row[selected.source] !== null : false;
  const matchedColumn = STATUS_OVERVIEW_COLUMNS.find((column) => {
    const item = row[column.source];
    return item ? editorSlotMatchesItem(editorSlot, item) : false;
  });
  return (
    <div
      className={`${TIMELINE_GRID} ${hasVisibleContent ? "" : "hidden md:grid"} border-b border-[var(--color-border-subtle)]`}
    >
      {STATUS_OVERVIEW_COLUMNS.map((column) => {
        const item = row[column.source];
        const matchesEditor = matchedColumn?.key === column.key;
        const layout = editorLaneClass(
          matchesEditor,
          matchedColumn !== undefined,
          idleTimelineLaneClass(column.key === activeColumn),
        );
        return (
          <div
            key={column.key}
            data-overview-lineage-lane={column.source}
            className={`${CELL} ${layout}`}
          >
            {item ? (
              <>
                {column.source === "previous" && row.previousParent ? (
                  <p className="mb-1 break-words text-xs text-[var(--color-muted-foreground)]">
                    Previously in {row.previousParent}
                  </p>
                ) : null}
                <ReportItemSlot
                  item={item}
                  onEditItem={onEditItem}
                  onQuickEditText={onQuickEditText}
                  onResolvePlan={onResolvePlan}
                  onRestorePlan={onRestorePlan}
                  editorSlot={editorSlot}
                />
              </>
            ) : (
              <span className="sr-only">No linked update</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StatusOverviewUnitRow({
  health,
  healthPanelId,
  healthExpanded,
  onInspect,
  onCloseHealth,
  unit,
  rows,
  periods,
  expanded,
  activeColumn,
  onToggle,
  panelId,
  onEditItem,
  onQuickEditText,
  onAddItem,
  onResolvePlan,
  onRestorePlan,
  editorSlot,
}: {
  readonly health?: ReportHealthUnit | undefined;
  readonly healthPanelId: string;
  readonly healthExpanded: boolean;
  readonly onInspect: OpenHealthDetail;
  readonly onCloseHealth: () => void;
  readonly unit: StatusOverviewUnit;
  readonly rows: readonly StatusOverviewLineageRow[];
  readonly periods: StatusOverviewModel["periods"];
  readonly expanded: boolean;
  readonly activeColumn: StatusOverviewColumnKey;
  readonly onToggle: () => void;
  readonly panelId: string;
} & ItemHandlers) {
  const more = reportHiddenRowCount(rows);
  return (
    <article
      aria-label={`${unit.kind === "product" ? "Product" : "Activity"} ${unit.name}`}
      className="min-w-0 border-t border-[var(--color-border-subtle)] first:border-t-0"
    >
      <div id={panelId} className={STATUS_OVERVIEW_DESKTOP_GRID}>
        <div className="min-w-0 px-4 py-3">
          <StatusOverviewUnitSummary
            unit={unit}
            health={health}
            healthExpanded={healthExpanded}
            healthPanelId={healthPanelId}
            onInspect={onInspect}
          />
        </div>
        <div className="min-w-0 min-[80rem]:col-span-3">
          <div className={`${TIMELINE_GRID} min-[80rem]:sr-only`}>
            {STATUS_OVERVIEW_COLUMNS.map((column) => (
              <div
                key={column.key}
                className={`${CELL} ${idleTimelineLaneClass(column.key === activeColumn)}`}
              >
                <p className="text-xs font-semibold">{column.label}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {periods[column.key] ?? "Period unavailable"}
                </p>
              </div>
            ))}
          </div>
          {unit.columns.previouslyPlanned.availability === "unavailable" ? (
            <p className="px-4 py-2 text-xs text-[var(--color-muted-foreground)]">
              {unit.columns.previouslyPlanned.reason}
            </p>
          ) : null}
          {rows.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
              No updates yet
            </p>
          ) : null}
          <ul className="min-w-0">
            {rows.filter(isLinkedOverviewRow).map((row, index) => (
              <li
                key={row.key}
                hidden={index >= REPORT_PREVIEW_COUNT && !expanded}
                inert={index >= REPORT_PREVIEW_COUNT && !expanded}
              >
                <LineageRow
                  row={row}
                  activeColumn={activeColumn}
                  onEditItem={onEditItem}
                  onQuickEditText={onQuickEditText}
                  onResolvePlan={onResolvePlan}
                  onRestorePlan={onRestorePlan}
                  editorSlot={editorSlot}
                />
              </li>
            ))}
          </ul>
          <StatusOverviewAdditionalUpdates
            rows={rows}
            expanded={expanded}
            activeColumn={activeColumn}
            onEditItem={onEditItem}
            onQuickEditText={onQuickEditText}
            onResolvePlan={onResolvePlan}
            onRestorePlan={onRestorePlan}
            editorSlot={editorSlot}
          />
          {more > 0 ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={onToggle}
              className="mx-4 min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              {expanded ? "Show less" : `+${String(more)} more`}
            </button>
          ) : null}
          <TimelineFooter
            unit={unit}
            activeColumn={activeColumn}
            onAddItem={onAddItem}
            editorSlot={editorSlot}
          />
        </div>
      </div>
      {health && healthExpanded ? (
        <ReportHealthDetail
          unit={health}
          panelId={healthPanelId}
          onClose={onCloseHealth}
        />
      ) : null}
    </article>
  );
}
