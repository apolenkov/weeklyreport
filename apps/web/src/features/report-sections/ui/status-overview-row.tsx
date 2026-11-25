import type { ReactNode } from "react";

import type { ReportHealthUnit } from "../model/report-health-pulse";
import type { StatusOverviewUnit } from "../model/status-overview";
import type { StatusOverviewLineageRow } from "../model/status-overview-lineage";
import { OverviewUnitRecords } from "./overview-unit-records";
import {
  type OpenHealthDetail,
  ReportHealthDetail,
} from "./report-health-pulse";
import type { ItemHandlers } from "./status-overview-item-handlers";
import { STATUS_OVERVIEW_DESKTOP_GRID } from "./status-overview-layout";
import { LineageRowList, ShowMoreButton } from "./status-overview-lineage-row";
import { StatusOverviewUnitSummary } from "./status-overview-summary";
import { StatusOverviewTimelineFooter } from "./status-overview-timeline-footer";

export { STATUS_OVERVIEW_DESKTOP_GRID };

function PreviousUnavailableNotice({
  column,
}: {
  readonly column: StatusOverviewUnit["columns"]["priorCommitments"];
}) {
  if (column.items.length > 0) return null;
  return (
    <p
      data-overview-lineage-lane="previous"
      className="px-4 py-2 text-xs text-[var(--color-muted-foreground)]"
    >
      {column.availability === "unavailable"
        ? "Last week’s report isn’t available."
        : "No update last week."}
    </p>
  );
}

interface StatusOverviewUnitRowProps extends ItemHandlers {
  readonly health?: ReportHealthUnit | undefined;
  readonly healthPanelId: string;
  readonly healthExpanded: boolean;
  readonly onInspect: OpenHealthDetail;
  readonly onCloseHealth: () => void;
  readonly unit: StatusOverviewUnit;
  readonly rows: readonly StatusOverviewLineageRow[];

  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly panelId: string;
  /** Optional control shown in the unit header (the Activity edit button). */
  readonly headerAction?: ReactNode;
}

export function StatusOverviewUnitRow({
  health,
  healthPanelId,
  healthExpanded,
  onInspect,
  onCloseHealth,
  unit,
  rows,
  expanded,
  onToggle,
  panelId,
  editorSlot,
  recordSlot,
  headerAction,
  ...handlers
}: StatusOverviewUnitRowProps) {
  return (
    <article
      id={unit.key}
      tabIndex={-1}
      aria-label={`${unit.kind === "product" ? "Product" : "Activity"} ${unit.name}`}
      className="min-w-0 border-t border-[var(--color-border-subtle)] first:border-t-0"
    >
      <div id={panelId} className="overview-unit">
        <div className="min-w-0 px-4 py-3">
          <StatusOverviewUnitSummary
            unit={unit}
            health={health}
            healthExpanded={healthExpanded}
            healthPanelId={healthPanelId}
            onInspect={onInspect}
            headerAction={headerAction}
          />
          <OverviewUnitRecords unit={unit} onAddRecord={handlers.onAddRecord} />
        </div>
        <div className="min-w-0 ">
          <PreviousUnavailableNotice column={unit.columns.lastWeek} />
          <LineageRowList
            rows={rows}
            expanded={expanded}
            editorSlot={editorSlot}
            handlers={handlers}
          />
          <StatusOverviewTimelineFooter
            unit={unit}
            onAddItem={handlers.onAddItem}
            onAddRecord={handlers.onAddRecord}
            ownedStageStarts={handlers.ownedStageStarts}
            editorSlot={editorSlot}
            recordSlot={recordSlot}
          />
          <ShowMoreButton
            rows={rows}
            expanded={expanded}
            panelId={panelId}
            onToggle={onToggle}
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
