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
function MobileWeekLabel({
  label,
  period,
}: {
  readonly label: string;
  readonly period: string | null;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2 md:hidden">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-foreground)]">
        {label}
      </p>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        {period ?? "Period unavailable"}
      </p>
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
  const editorBelongsToRow = Boolean(
    editorSlot &&
    editorSlot.mode !== "create" &&
    (editorSlot.stableId
      ? STATUS_OVERVIEW_COLUMNS.some(
          (column) => row[column.source]?.stableId === editorSlot.stableId,
        )
      : editorSlot.recordId &&
        STATUS_OVERVIEW_COLUMNS.some(
          (column) => row[column.source]?.recordId === editorSlot.recordId,
        )),
  );
  return (
    <div
      className={`${TIMELINE_GRID} mx-3 my-3 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-card)] md:m-0 md:rounded-none md:border-0 md:border-b md:items-stretch`}
    >
      {STATUS_OVERVIEW_COLUMNS.map((column) => {
        const item = row[column.source];
        return (
          <div
            key={column.key}
            data-overview-lineage-lane={column.source}
            role="group"
            aria-labelledby={STATUS_OVERVIEW_COLUMN_HEADER_IDS[column.key]}
            className={`${TIMELINE_CELL} block border-t border-[var(--color-border-subtle)] first:border-t-0 md:min-h-36 md:flex-col md:border-t-0 md:flex ${item ? "" : "bg-[var(--color-surface-muted)]"}`}
          >
            <MobileWeekLabel
              label={column.label}
              period={periods[column.key]}
            />
            {item ? (
              <>
                {column.source === "previous" && row.previousParent ? (
                  <p className="mb-1 break-words text-xs text-[var(--color-muted-foreground)]">
                    Previously in {row.previousParent}
                  </p>
                ) : null}
                <ReportItemSlot item={item} {...handlers} />
              </>
            ) : (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                No item
              </p>
            )}
          </div>
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
          <div
            className={`${TIMELINE_GRID} min-[80rem]:sr-only bg-[var(--color-surface-muted)]`}
          >
            {STATUS_OVERVIEW_COLUMNS.map((column) => (
              <div key={column.key} className={TIMELINE_CELL}>
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
