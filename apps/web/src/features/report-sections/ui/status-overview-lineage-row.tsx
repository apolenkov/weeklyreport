import type { StatusOverviewModel } from "../model/status-overview";
import type { StatusOverviewLineageRow } from "../model/status-overview-lineage";
import {
  REPORT_PREVIEW_COUNT,
  reportHiddenRowCount,
  ReportItemSlot,
} from "./status-overview-additional-updates";
import type { ItemHandlers } from "./status-overview-item-handlers";
import { Lane } from "./status-overview-lane";
import {
  STATUS_OVERVIEW_COLUMNS,
  TIMELINE_CELL,
  TIMELINE_GRID,
} from "./status-overview-layout";

const PERIOD_UNAVAILABLE = "Period unavailable";
function editorBelongsToLineageRow(
  row: StatusOverviewLineageRow,
  editorSlot: ItemHandlers["editorSlot"],
): boolean {
  if (!editorSlot || editorSlot.mode === "create") return false;
  if (editorSlot.stableId) {
    return STATUS_OVERVIEW_COLUMNS.some(
      (column) =>
        (column.source === "previous" ? row.last : row[column.source])
          ?.stableId === editorSlot.stableId,
    );
  }
  return Boolean(
    editorSlot.recordId &&
    STATUS_OVERVIEW_COLUMNS.some(
      (column) =>
        (column.source === "previous" ? row.last : row[column.source])
          ?.recordId === editorSlot.recordId,
    ),
  );
}

function EmptyLane({
  column,
}: {
  readonly column: (typeof STATUS_OVERVIEW_COLUMNS)[number];
}) {
  // R55: an empty lane stays a quiet muted cell — one em dash instead of a
  // "No item" caption that competes with real content; on mobile it folds
  // into one summary per unit, after its lineage row list. The dash is hidden
  // from assistive technology; the screen-reader sentence carries the meaning.
  // Creation lives in the unit header only, so the cell offers no Add.
  return (
    <Lane
      column={column}
      className={`${TIMELINE_CELL} overview-empty-lane text-center`}
    >
      <span
        aria-hidden="true"
        className="text-sm text-[var(--color-muted-foreground)]"
      >
        —
      </span>
      <span className="sr-only">No entry in {column.label}</span>
    </Lane>
  );
}

export function MobilePeriodsSummary({
  periods,
}: {
  readonly periods: StatusOverviewModel["periods"];
}) {
  // R15: one shared periods header per product on mobile instead of a strip
  // repeated inside every row cell.
  return (
    <div
      data-testid="overview-mobile-periods"
      role="group"
      aria-label="Reporting periods"
      className="mx-3 mb-2 grid grid-cols-3 gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-2 py-1.5 md:hidden"
    >
      {STATUS_OVERVIEW_COLUMNS.map((column) => (
        <div key={column.key} className="min-w-0">
          <span className="block text-xs font-semibold text-[var(--color-muted-foreground)]">
            {column.label}
          </span>
          <p className="break-words text-xs text-[var(--color-muted-foreground)]">
            {periods[column.key] ?? PERIOD_UNAVAILABLE}
          </p>
        </div>
      ))}
    </div>
  );
}

function itemInWeek(row:StatusOverviewLineageRow,source:"previous"|"current"|"next"){
 if(source==="previous")return row.last;
 if(source==="next")return row.next;
 if(row.current)return row.current;
 return row.answerState==="pending" && !row.next ? row.priorCommitment:null;
}

function LineageRow({
  row,
  editorSlot,
  ...handlers
}: {
  readonly row: StatusOverviewLineageRow;
  readonly editorSlot: ItemHandlers["editorSlot"];
} & Omit<ItemHandlers, "editorSlot">) {
  // Creation lives in the unit header; rows never render an Add control.
  const { onAddItem: _onAddItem, ...itemHandlers } = handlers;
  const editorBelongsToRow = editorBelongsToLineageRow(row, editorSlot);
  return (
    <div
      data-testid="overview-lineage-row"
      className={`${TIMELINE_GRID} min-w-0 items-stretch border-b border-[var(--color-border-subtle)]`}
    >
      {STATUS_OVERVIEW_COLUMNS.map((column) => {
        const item = itemInWeek(row,column.source);
        if (!item) return <EmptyLane key={column.key} column={column} />;
        return (
          <Lane
            key={column.key}
            column={column}
            className="min-w-0 px-3 py-1 block border-t border-[var(--color-border-subtle)] first:border-t-0 md:px-4 md:py-3  md:flex-col md:border-t-0 first:md:border-l-0 md:border-l md:border-[var(--color-border-subtle)] md:flex"
          >
            {column.source === "previous" && row.previousParent ? (
              <p className="mb-1 break-words text-xs text-[var(--color-muted-foreground)]">
                Previously in {row.previousParent}
              </p>
            ) : null}
            <ReportItemSlot
              item={item}
              activity={handlers.ownedStages === undefined}
              occupied={
                column.source === "next"
                  ? !!row.current
                  : !!row.next && row.next.recordId !== item.recordId
              }
              published={!!row.last || !!row.priorCommitment}
              {...itemHandlers}
            />
          </Lane>
        );
      })}
      {editorBelongsToRow ? (
        <div className="min-w-0 border-t border-[var(--color-border-subtle)] bg-[var(--color-card)] px-4 py-3 md:col-span-3">
          {editorSlot?.content}
        </div>
      ) : null}
    </div>
  );
}

export function DesktopPeriodHeader({
  periods,
}: {
  readonly periods: StatusOverviewModel["periods"];
}) {
  return (
    <div
      className={`${TIMELINE_GRID} max-md:hidden bg-[var(--color-surface-muted)]`}
    >
      {STATUS_OVERVIEW_COLUMNS.map((column) => (
        <div key={column.key} className={TIMELINE_CELL}>
          <p className="text-xs font-semibold">{column.label}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {periods[column.key] ?? PERIOD_UNAVAILABLE}
          </p>
        </div>
      ))}
    </div>
  );
}

export function LineageRowList({
  rows,
  expanded,
  editorSlot,
  handlers,
}: {
  readonly rows: readonly StatusOverviewLineageRow[];
  readonly expanded: boolean;
  readonly editorSlot: ItemHandlers["editorSlot"];
  readonly handlers: Omit<ItemHandlers, "editorSlot">;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-2 text-sm text-[var(--color-muted-foreground)]">
        No items yet
      </p>
    );
  }
  return (
    <ul className="min-w-0">
      {rows.map((row, index) => (
        <li
          key={row.key}
          hidden={index >= REPORT_PREVIEW_COUNT && !expanded}
          inert={index >= REPORT_PREVIEW_COUNT && !expanded}
        >
          <LineageRow row={row} editorSlot={editorSlot} {...handlers} />
        </li>
      ))}
    </ul>
  );
}

export function ShowMoreButton({
  rows,
  expanded,
  panelId,
  onToggle,
}: {
  readonly rows: readonly StatusOverviewLineageRow[];
  readonly expanded: boolean;
  readonly panelId: string;
  readonly onToggle: () => void;
}) {
  const more = reportHiddenRowCount(rows);
  if (more <= 0) return null;
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={panelId}
      onClick={onToggle}
      className="mx-4 min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      {expanded ? "Show less" : `+${String(more)} more`}
    </button>
  );
}
