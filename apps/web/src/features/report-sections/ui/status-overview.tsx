"use client";

import { useId, useState } from "react";

import type {
  StatusOverviewEditTarget,
  StatusOverviewModel,
} from "../model/status-overview";
import {
  STATUS_OVERVIEW_DESKTOP_GRID,
  type StatusOverviewColumnKey,
  StatusOverviewUnitRow,
} from "./status-overview-row";

export interface StatusOverviewProps {
  readonly model: StatusOverviewModel;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly detailsHref?: string | undefined;
  readonly autosaveStatus?: string | undefined;
}

function ColumnHeading({
  label,
  period,
}: {
  readonly label: string;
  readonly period: string | null;
}) {
  return (
    <div className="min-w-0 border-l border-[var(--color-border-subtle)] px-4 pb-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs text-[var(--color-foreground)]">
        {period ?? "Period unavailable"}
      </p>
    </div>
  );
}

function expansionKey(
  unitKey: string,
  column: StatusOverviewColumnKey,
): string {
  return `${unitKey}:${column}`;
}

export function StatusOverview({
  model,
  onEditItem,
  detailsHref,
  autosaveStatus,
}: StatusOverviewProps) {
  const idPrefix = useId();
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggle = (key: string): void => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section
      aria-labelledby={`${idPrefix}-heading`}
      data-testid="status-overview"
      className="min-w-0 max-w-full"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            id={`${idPrefix}-heading`}
            className="text-xl font-semibold tracking-[-0.02em] text-[var(--color-foreground)]"
          >
            Status overview
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Prior commitments, current delivery, and the next plan in one view.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {model.previousPlanSource ? (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Prior plan: {model.previousPlanSource}
            </span>
          ) : null}
          {autosaveStatus ? (
            <p
              role="status"
              aria-live="polite"
              className="text-xs font-medium text-[var(--color-muted-foreground)]"
            >
              {autosaveStatus}
            </p>
          ) : null}
          {detailsHref ? (
            <a
              href={detailsHref}
              className="inline-flex min-h-8 items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-3 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              Edit full report
            </a>
          ) : null}
        </div>
      </div>

      <div
        aria-hidden="true"
        className={`mb-1 hidden ${STATUS_OVERVIEW_DESKTOP_GRID}`}
      >
        <div />
        <ColumnHeading
          label="Previously planned"
          period={model.periods.previouslyPlanned}
        />
        <ColumnHeading
          label="Current week"
          period={model.periods.currentWeek}
        />
        <ColumnHeading label="Next week" period={model.periods.nextWeek} />
      </div>

      {model.units.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No reporting units are available for this period.
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-[var(--radius)] border-y border-[var(--color-border-subtle)] bg-[var(--color-card)]">
          {model.units.map((unit, index) => {
            const expandedColumns = new Set<StatusOverviewColumnKey>(
              (
                ["previouslyPlanned", "currentWeek", "nextWeek"] as const
              ).filter((column) =>
                expandedKeys.has(expansionKey(unit.key, column)),
              ),
            );
            return (
              <StatusOverviewUnitRow
                key={unit.key}
                unit={unit}
                periods={model.periods}
                expandedColumns={expandedColumns}
                onToggle={(column) => toggle(expansionKey(unit.key, column))}
                panelId={`${idPrefix}-unit-${String(index)}`}
                onEditItem={onEditItem}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
