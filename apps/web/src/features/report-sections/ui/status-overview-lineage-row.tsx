import type { StatusOverviewModel } from "../model/status-overview";
import type { StatusOverviewLineageRow } from "../model/status-overview-lineage";
import {
  REPORT_PREVIEW_COUNT,
  reportHiddenRowCount,
  ReportItemSlot,
} from "./status-overview-additional-updates";
import type { ItemHandlers } from "./status-overview-item-handlers";
import {
  STATUS_OVERVIEW_COLUMN_HEADER_IDS,
  STATUS_OVERVIEW_COLUMNS,
  TIMELINE_CELL,
  TIMELINE_GRID,
} from "./status-overview-layout";

const PERIOD_UNAVAILABLE = "Period unavailable";
function MobileWeekLabel({ label }: { readonly label: string }) {
  return (
    <p className="text-xs font-semibold text-[var(--color-muted-foreground)] md:hidden">
      {label}
    </p>
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
  // into one summary per unit, after its lineage row list.
  return (
    <div
      data-overview-lineage-lane={column.source}
      className={`${TIMELINE_CELL} hidden md:min-h-24 md:flex md:flex-col md:items-center md:justify-center md:border-t-0 bg-[var(--color-surface-muted)]`}
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

function LineageRow({
  row,
  editorSlot,
  ...handlers
}: {
  readonly row: StatusOverviewLineageRow;
} & Omit<ItemHandlers, "onAddItem">) {
  const editorBelongsToRow = editorBelongsToLineageRow(row, editorSlot);
  return (
    <div
      data-testid="overview-lineage-row"
      className={`${TIMELINE_GRID} mx-3 my-1.5 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-card)] md:m-0 md:rounded-none md:border-0 md:border-b md:items-stretch`}
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
            className="min-w-0 px-3 py-1 block border-t border-[var(--color-border-subtle)] first:border-t-0 md:px-4 md:py-3 md:min-h-24 md:flex-col md:border-t-0 md:border-l md:border-[var(--color-border-subtle)] md:flex"
          >
            <MobileWeekLabel label={column.label} />
            {column.source === "previous" && row.previousParent ? (
              <p className="mb-1 break-words text-xs text-[var(--color-muted-foreground)]">
                Previously in {row.previousParent}
              </p>
            ) : null}
            <ReportItemSlot item={item} {...handlers} />
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

export function DesktopPeriodHeader({
  periods,
}: {
  readonly periods: StatusOverviewModel["periods"];
}) {
  return (
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
    <>
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
      {rows.some((row) =>
        STATUS_OVERVIEW_COLUMNS.some((column) => !row[column.source]),
      ) ? (
        <p
          data-testid="overview-mobile-empty-periods"
          className="mx-3 px-3 py-1 text-xs text-[var(--color-muted-foreground)] md:hidden"
        >
          No items in other periods
        </p>
      ) : null}
    </>
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
