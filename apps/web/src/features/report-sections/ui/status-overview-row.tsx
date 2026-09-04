import { Plus } from "lucide-react";

import type {
  StatusOverviewColumn,
  StatusOverviewCreateTarget,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewModel,
  StatusOverviewUnit,
} from "../model/status-overview";
import { StatusOverviewUnitSummary } from "./status-overview-summary";

export const STATUS_OVERVIEW_DESKTOP_GRID =
  "min-[80rem]:grid min-[80rem]:grid-cols-[minmax(13rem,0.8fr)_repeat(3,minmax(0,1fr))]";

export type StatusOverviewColumnKey = keyof StatusOverviewUnit["columns"];

interface EditItemHandler {
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
}

interface CreateItemHandler {
  readonly addTarget: StatusOverviewCreateTarget | null;
  readonly unitName: string;
  readonly onAddItem?:
    ((target: StatusOverviewCreateTarget) => void) | undefined;
}

function ContinuityBadge({ item }: { readonly item: StatusOverviewItem }) {
  if (item.continuity == null) return null;
  const unplanned = item.continuity === "unplanned";
  return (
    <span
      className={
        unplanned
          ? "rounded-[var(--radius-pill)] bg-[var(--color-status-at-risk-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-status-at-risk-fg)]"
          : "rounded-[var(--radius-pill)] bg-[var(--color-success)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]"
      }
    >
      {unplanned ? "Unplanned" : "Continued"}
    </span>
  );
}

function ItemPreviewContent({ item }: { readonly item: StatusOverviewItem }) {
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-start gap-1.5">
        <p className="min-w-0 flex-1 break-words text-sm leading-5 text-[var(--color-foreground)]">
          {item.text}
        </p>
        <ContinuityBadge item={item} />
      </div>
      {item.tag ? (
        <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
          {item.tag}
        </p>
      ) : null}
    </>
  );
}

function ItemPreview({
  item,
  onEditItem,
}: { readonly item: StatusOverviewItem } & EditItemHandler) {
  const target = item.editTarget;
  if (target && onEditItem) {
    return (
      <li className="min-w-0">
        <button
          type="button"
          aria-label={`Edit ${item.text}`}
          onClick={() => onEditItem(target)}
          className="group flex min-h-[var(--touch-target-min)] w-full min-w-0 items-center gap-2 px-1 py-2 text-left transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]"
        >
          <span className="min-w-0 flex-1">
            <ItemPreviewContent item={item} />
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-[var(--color-primary)] opacity-70 group-hover:opacity-100">
            Edit
          </span>
        </button>
      </li>
    );
  }
  return (
    <li className="min-w-0 px-1 py-2">
      <ItemPreviewContent item={item} />
    </li>
  );
}

function TimelineColumn({
  column,
  expanded,
  additionalId,
  onToggle,
  onEditItem,
  addTarget,
  unitName,
  onAddItem,
}: {
  readonly column: StatusOverviewColumn;
  readonly expanded: boolean;
  readonly additionalId: string;
  readonly onToggle: () => void;
} & EditItemHandler &
  CreateItemHandler) {
  if (column.availability === "unavailable") {
    return (
      <p className="border-l-2 border-[var(--color-border)] pl-2 text-xs text-[var(--color-muted-foreground)]">
        {column.reason}
      </p>
    );
  }
  const previews = column.items.slice(0, 2);
  const additional = column.items.slice(2);
  return (
    <>
      {column.items.length === 0 ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          No updates
        </p>
      ) : (
        <ul className="min-w-0 divide-y divide-[var(--color-border-subtle)]">
          {previews.map((item) => (
            <ItemPreview key={item.key} item={item} onEditItem={onEditItem} />
          ))}
          {additional.length > 0 ? (
            <li id={additionalId} hidden={!expanded} inert={!expanded}>
              <ul className="divide-y divide-[var(--color-border-subtle)]">
                {additional.map((item) => (
                  <ItemPreview
                    key={item.key}
                    item={item}
                    onEditItem={onEditItem}
                  />
                ))}
              </ul>
            </li>
          ) : null}
        </ul>
      )}
      {additional.length > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={additionalId}
          onClick={onToggle}
          className="mt-1 min-h-8 rounded-[var(--radius-pill)] px-2 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          {expanded ? "Show less" : `+${String(additional.length)} more`}
        </button>
      ) : null}
      {addTarget && onAddItem ? (
        <button
          type="button"
          aria-label={`Add ${addTarget.source} week update to ${unitName}`}
          onClick={() => onAddItem(addTarget)}
          className="mt-2 inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-[var(--radius-pill)] px-2 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] md:min-h-8"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Add update
        </button>
      ) : null}
    </>
  );
}

function TimelineCell({
  label,
  period,
  column,
  expanded,
  additionalId,
  onToggle,
  onEditItem,
  addTarget,
  unitName,
  onAddItem,
}: {
  readonly label: string;
  readonly period: string | null;
  readonly column: StatusOverviewColumn;
  readonly expanded: boolean;
  readonly additionalId: string;
  readonly onToggle: () => void;
} & EditItemHandler &
  CreateItemHandler) {
  return (
    <div className="min-w-0 border-t border-[var(--color-border-subtle)] px-4 py-3 min-[80rem]:border-t-0 min-[80rem]:border-l">
      <div className="mb-2 min-[80rem]:sr-only">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
          {label}
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {period ?? "Period unavailable"}
        </p>
      </div>
      <TimelineColumn
        column={column}
        expanded={expanded}
        additionalId={additionalId}
        onToggle={onToggle}
        onEditItem={onEditItem}
        addTarget={addTarget}
        unitName={unitName}
        onAddItem={onAddItem}
      />
    </div>
  );
}

const COLUMN_CONFIG: readonly {
  readonly key: StatusOverviewColumnKey;
  readonly label: string;
  readonly idPart: string;
}[] = [
  { key: "previouslyPlanned", label: "Previously planned", idPart: "previous" },
  { key: "currentWeek", label: "Current week", idPart: "current" },
  { key: "nextWeek", label: "Next week", idPart: "next" },
];

export function StatusOverviewUnitRow({
  unit,
  periods,
  expandedColumns,
  onToggle,
  panelId,
  onEditItem,
  onAddItem,
}: {
  readonly unit: StatusOverviewUnit;
  readonly periods: StatusOverviewModel["periods"];
  readonly expandedColumns: ReadonlySet<StatusOverviewColumnKey>;
  readonly onToggle: (column: StatusOverviewColumnKey) => void;
  readonly panelId: string;
} & EditItemHandler & {
    readonly onAddItem?:
      ((target: StatusOverviewCreateTarget) => void) | undefined;
  }) {
  return (
    <article
      aria-label={`${unit.kind === "product" ? "Product" : "Activity"} ${unit.name}`}
      className="min-w-0 overflow-hidden border-t border-[var(--color-border-subtle)] first:border-t-0"
    >
      <div id={panelId} className={STATUS_OVERVIEW_DESKTOP_GRID}>
        <div className="min-w-0 px-4 py-3">
          <StatusOverviewUnitSummary unit={unit} />
        </div>
        {COLUMN_CONFIG.map((config) => (
          <TimelineCell
            key={config.key}
            label={config.label}
            period={periods[config.key]}
            column={unit.columns[config.key]}
            expanded={expandedColumns.has(config.key)}
            additionalId={`${panelId}-${config.idPart}-additional`}
            onToggle={() => onToggle(config.key)}
            onEditItem={onEditItem}
            addTarget={
              onAddItem &&
              !unit.historical &&
              config.key !== "previouslyPlanned"
                ? {
                    source: config.key === "currentWeek" ? "current" : "next",
                    unitKind: unit.kind,
                    unitId: unit.id,
                  }
                : null
            }
            unitName={unit.name}
            onAddItem={onAddItem}
          />
        ))}
      </div>
    </article>
  );
}
