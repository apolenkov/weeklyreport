import type { ReactNode } from "react";

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
import type { ItemHandlers } from "./status-overview-item-handlers";
import { STATUS_OVERVIEW_DESKTOP_GRID } from "./status-overview-layout";
import {
  DesktopPeriodHeader,
  LineageRowList,
  MobilePeriodsSummary,
  ShowMoreButton,
} from "./status-overview-lineage-row";
import { StatusOverviewUnitSummary } from "./status-overview-summary";
import { TimelineFooter } from "./status-overview-timeline-footer";

export { STATUS_OVERVIEW_DESKTOP_GRID };

function PreviousUnavailableNotice({
  column,
}: {
  readonly column: StatusOverviewUnit["columns"]["previouslyPlanned"];
}) {
  if (column.availability !== "unavailable") return null;
  return (
    <p className="px-4 py-2 text-xs text-[var(--color-muted-foreground)]">
      {column.reason}
    </p>
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
  headerAction,
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
  /** Optional control shown in the unit header (the Activity edit button). */
  readonly headerAction?: ReactNode;
} & ItemHandlers) {
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
            headerAction={headerAction}
          />
        </div>
        <div className="min-w-0 min-[80rem]:col-span-3">
          <MobilePeriodsSummary periods={periods} />
          <DesktopPeriodHeader periods={periods} />
          <PreviousUnavailableNotice column={unit.columns.previouslyPlanned} />
          <LineageRowList
            rows={rows}
            periods={periods}
            expanded={expanded}
            editorSlot={editorSlot}
            handlers={handlers}
          />
          <ShowMoreButton
            rows={rows}
            expanded={expanded}
            panelId={panelId}
            onToggle={onToggle}
          />
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
