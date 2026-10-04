import type { ReportHealthUnit } from "../model/report-health-pulse";
import type {
  StatusOverviewModel,
  StatusOverviewUnit,
} from "../model/status-overview";
import type { StatusOverviewLineageRow } from "../model/status-overview-lineage";
import {
  type OpenHealthDetail,
  ReportHealthDetail,
} from "./report-health-pulse";
import {
  REPORT_PREVIEW_COUNT,
  reportHiddenRowCount,
  ReportItemSlot,
} from "./status-overview-additional-updates";
import type { ItemHandlers } from "./status-overview-item-handlers";
import {
  STATUS_OVERVIEW_COLUMN_HEADER_IDS,
  STATUS_OVERVIEW_COLUMNS,
  STATUS_OVERVIEW_DESKTOP_GRID,
  TIMELINE_CELL,
  TIMELINE_GRID,
} from "./status-overview-layout";
import { StatusOverviewUnitSummary } from "./status-overview-summary";
import { TimelineFooter } from "./status-overview-timeline-footer";

export { STATUS_OVERVIEW_DESKTOP_GRID };

const PERIOD_UNAVAILABLE = "Period unavailable";
function MobileWeekLabel({
  label,
  period,
}: {
  readonly label: string;
  readonly period: string | null | undefined;
}) {
  // `undefined` marks an empty cell: the label shares one line with "No item".
  return (
    <div
      className={`flex items-baseline justify-between gap-2 md:hidden ${period === undefined ? "" : "mb-2"}`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-foreground)]">
        {label}
      </p>
      {period === undefined ? null : (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {period ?? PERIOD_UNAVAILABLE}
        </p>
      )}
    </div>
  );
}

function editorBelongsToLineageRow(
  row: StatusOverviewLineageRow,
  editorSlot: ItemHandlers["editorSlot"],
): boolean {
  if (!editorSlot || editorSlot.mode === "create") return false;
  if (editorSlot.stableId) {
    return STATUS_OVERVIEW_COLUMNS.some(
      (column) => row[column.source]?.stableId === editorSlot.stableId,
    );
  }
  return Boolean(
    editorSlot.recordId &&
    STATUS_OVERVIEW_COLUMNS.some(
      (column) => row[column.source]?.recordId === editorSlot.recordId,
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
  // into the single summary line below the row.
  return (
    <div
      data-overview-lineage-lane={column.source}
      className={`${TIMELINE_CELL} hidden md:min-h-36 md:flex md:flex-col md:items-center md:justify-center md:border-t-0 bg-[var(--color-surface-muted)]`}
    >
      <span
        aria-hidden="true"
        className="text-sm text-[var(--color-muted-foreground)]"
      >
        —
      </span>
      <span className="sr-only">No item in this period</span>
    </div>
  );
}

function MobilePeriodsSummary({
  periods,
}: {
  readonly periods: StatusOverviewModel["periods"];
}) {
  // R15: one shared periods header per product on mobile instead of a strip
  // repeated inside every row cell.
  return (
    <div className="mx-3 mb-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-4 py-2 md:hidden">
      {STATUS_OVERVIEW_COLUMNS.map((column) => (
        <div
          key={column.key}
          className="flex items-baseline justify-between gap-2 py-0.5"
        >
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-foreground)]">
            {column.label}
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {periods[column.key] ?? PERIOD_UNAVAILABLE}
          </p>
        </div>
      ))}
    </div>
  );
}

function LineageRow({
  row,
  periods,
  editorSlot,
  ...handlers
}: {
  readonly row: StatusOverviewLineageRow;
  readonly periods: StatusOverviewModel["periods"];
} & Omit<ItemHandlers, "onAddItem">) {
  const editorBelongsToRow = editorBelongsToLineageRow(row, editorSlot);
  const emptyColumns = STATUS_OVERVIEW_COLUMNS.filter(
    (column) => !row[column.source],
  );
  return (
    <div
      className={`${TIMELINE_GRID} mx-3 my-3 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-card)] md:m-0 md:rounded-none md:border-0 md:border-b md:items-stretch`}
    >
      {STATUS_OVERVIEW_COLUMNS.map((column) => {
        const item = row[column.source];
        if (!item) return <EmptyLane key={column.key} column={column} />;
        return (
          <div
            key={column.key}
            data-overview-lineage-lane={column.source}
            role="group"
            aria-labelledby={STATUS_OVERVIEW_COLUMN_HEADER_IDS[column.key]}
            className={`${TIMELINE_CELL} block border-t border-[var(--color-border-subtle)] first:border-t-0 md:min-h-36 md:flex-col md:border-t-0 md:flex`}
          >
            <MobileWeekLabel
              label={column.label}
              period={periods[column.key]}
            />
            {column.source === "previous" && row.previousParent ? (
              <p className="mb-1 break-words text-xs text-[var(--color-muted-foreground)]">
                Previously in {row.previousParent}
              </p>
            ) : null}
            <ReportItemSlot item={item} {...handlers} />
          </div>
        );
      })}
      {/* R15: one muted line replaces the per-empty-period strips on mobile. */}
      {emptyColumns.length > 0 ? (
        <p className="border-t border-[var(--color-border-subtle)] px-4 py-1.5 text-xs text-[var(--color-muted-foreground)] md:hidden">
          {emptyColumns.length === 1
            ? `No item in ${emptyColumns[0]?.label ?? "this period"}`
            : "No items in other periods"}
        </p>
      ) : null}
      {editorBelongsToRow ? (
        <div className="min-w-0 border-t border-[var(--color-border-subtle)] bg-[var(--color-card)] px-4 py-3 md:col-span-3">
          {editorSlot?.content}
        </div>
      ) : null}
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
  onToggle,
  panelId,
  editorSlot,
  ...handlers
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
          <MobilePeriodsSummary periods={periods} />
          <div
            className={`${TIMELINE_GRID} max-md:hidden min-[80rem]:sr-only bg-[var(--color-surface-muted)]`}
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
          {unit.columns.previouslyPlanned.availability === "unavailable" ? (
            <p className="px-4 py-2 text-xs text-[var(--color-muted-foreground)]">
              {unit.columns.previouslyPlanned.reason}
            </p>
          ) : null}
          {rows.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
              No items yet
            </p>
          ) : (
            <ul className="min-w-0">
              {rows.map((row, index) => (
                <li
                  key={row.key}
                  hidden={index >= REPORT_PREVIEW_COUNT && !expanded}
                  inert={index >= REPORT_PREVIEW_COUNT && !expanded}
                >
                  <LineageRow
                    row={row}
                    periods={periods}
                    editorSlot={editorSlot}
                    {...handlers}
                  />
                </li>
              ))}
            </ul>
          )}
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
            onAddItem={handlers.onAddItem}
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
