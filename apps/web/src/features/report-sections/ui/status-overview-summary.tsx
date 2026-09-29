import { useState } from "react";

import {
  statusDotClassName,
  statusLabel,
  statusToneClassName,
} from "../../../shared/lib/status/status-presentation";
import type { ReportHealthUnit } from "../model/report-health-pulse";
import type { StatusOverviewUnit } from "../model/status-overview";
import { healthLocations, type OpenHealthDetail } from "./report-health-pulse";

function StatusBadge({ unit }: { readonly unit: StatusOverviewUnit }) {
  if (unit.status !== "blocked" && unit.status !== "at-risk") return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[11px] font-semibold ${statusToneClassName(unit.status)}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${statusDotClassName(unit.status)}`}
      />
      {statusLabel(unit.status, "screen")}
    </span>
  );
}

const STAGE_PREVIEW_COUNT = 3;

function StageSummary({ unit }: { readonly unit: StatusOverviewUnit }) {
  const [expanded, setExpanded] = useState(false);
  const visibleStages = expanded
    ? unit.stages
    : unit.stages.slice(0, STAGE_PREVIEW_COUNT);
  return (
    <>
      {visibleStages.length > 0 ? (
        <ul aria-label={`Stages for ${unit.name}`} className="space-y-1">
          {visibleStages.map((stage) => (
            <li
              key={stage.name}
              className="flex items-baseline gap-1.5 break-words text-xs text-[var(--color-muted-foreground)]"
            >
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${statusDotClassName(stage.status)}`}
              />
              <span>
                {stage.name} · {statusLabel(stage.status, "screen")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {unit.stages.length > STAGE_PREVIEW_COUNT ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          {expanded
            ? "Show fewer stages"
            : `Show all ${String(unit.stages.length)} stages`}
        </button>
      ) : null}
    </>
  );
}

function UnitName({
  unit,
  health,
  healthExpanded,
  healthPanelId,
  onInspect,
}: {
  readonly unit: StatusOverviewUnit;
  readonly health?: ReportHealthUnit | undefined;
  readonly healthExpanded: boolean;
  readonly healthPanelId: string;
  readonly onInspect: OpenHealthDetail;
}) {
  if (!health) {
    return (
      <p className="break-words font-semibold leading-5 text-[var(--color-foreground)]">
        {unit.name}
      </p>
    );
  }
  return (
    <button
      type="button"
      aria-expanded={healthExpanded}
      aria-controls={healthExpanded ? healthPanelId : undefined}
      onClick={(event) => onInspect(unit.key, event.currentTarget)}
      className="min-h-[var(--touch-target-min)] max-w-full rounded-[var(--radius-sm)] text-left font-semibold leading-5 break-words text-[var(--color-primary)] underline decoration-[var(--color-border-strong)] underline-offset-4 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      {unit.name}
    </button>
  );
}

export function StatusOverviewUnitSummary({
  unit,
  health,
  healthExpanded,
  healthPanelId,
  onInspect,
}: {
  readonly unit: StatusOverviewUnit;
  readonly health?: ReportHealthUnit | undefined;
  readonly healthExpanded: boolean;
  readonly healthPanelId: string;
  readonly onInspect: OpenHealthDetail;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <UnitName
        unit={unit}
        health={health}
        healthExpanded={healthExpanded}
        healthPanelId={healthPanelId}
        onInspect={onInspect}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <StatusBadge
          unit={health ? { ...unit, status: health.status } : unit}
        />
        {unit.historical ? (
          <span className="text-[11px] font-semibold text-[var(--color-muted-foreground)]">
            Historical
          </span>
        ) : null}
        {unit.stages.length > 0 ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {unit.stages.length} owned{" "}
            {unit.stages.length === 1 ? "stage" : "stages"}
          </span>
        ) : null}
      </div>
      {health ? (
        healthLocations(health) ? (
          <p className="break-words text-xs text-[var(--color-muted-foreground)]">
            {healthLocations(health)}
          </p>
        ) : null
      ) : (
        <StageSummary unit={unit} />
      )}
      {unit.linkedProducts.length > 0 ? (
        <p className="break-words text-xs text-[var(--color-muted-foreground)]">
          Products: {unit.linkedProducts.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
