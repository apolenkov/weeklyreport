"use client";

import { useEffect, useId, useState } from "react";

import type { ReportHealthPulse } from "../model/report-health-pulse";
import type {
  StatusOverviewCreateTarget,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewModel,
  StatusOverviewUnitKind,
} from "../model/status-overview";
import { buildStatusOverviewLineage } from "../model/status-overview-lineage";
import { ReportHealthPulseView } from "./report-health-pulse";
import type { StatusOverviewEditorSlot } from "./status-overview-editor-slot";
import {
  STATUS_OVERVIEW_COLUMNS,
  STATUS_OVERVIEW_DESKTOP_GRID,
  type StatusOverviewColumnKey,
  StatusOverviewUnitRow,
} from "./status-overview-row";

export interface StatusOverviewProps {
  readonly health?: ReportHealthPulse | undefined;
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
  readonly model: StatusOverviewModel;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onQuickEditText?:
    ((item: StatusOverviewItem, text: string) => void) | undefined;
  readonly onAddItem?:
    ((target: StatusOverviewCreateTarget) => void) | undefined;
  readonly onResolvePlan?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onRestorePlan?: ((item: StatusOverviewItem) => void) | undefined;
  readonly detailsHref?: string | undefined;
  readonly autosaveStatus?: string | undefined;
}

const UNIT_GROUPS: readonly {
  readonly kind: StatusOverviewUnitKind;
  readonly label: string;
}[] = [
  { kind: "product", label: "Products" },
  { kind: "activity", label: "Project activities" },
];

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

function resolveDisplayedColumn(
  active: StatusOverviewColumnKey,
  editorSlot: StatusOverviewEditorSlot | undefined,
): StatusOverviewColumnKey {
  if (!editorSlot) return active;
  if (editorSlot.source === "previous") return "previouslyPlanned";
  return editorSlot.source === "next" ? "nextWeek" : "currentWeek";
}

function useHealthInspection(idPrefix: string) {
  const [inspection, setInspection] = useState<{
    key: string;
    opener: HTMLButtonElement;
  } | null>(null);
  const healthPanelId = `${idPrefix}-health-detail`;
  useEffect(() => {
    if (inspection) document.getElementById(healthPanelId)?.focus();
  }, [inspection, healthPanelId]);
  const closeInspection = (): void => {
    const opener = inspection?.opener;
    setInspection(null);
    if (opener?.isConnected) opener.focus();
    else document.getElementById(`${idPrefix}-heading`)?.focus();
  };
  return { closeInspection, healthPanelId, inspection, setInspection };
}

function buildAddItemHandler(
  onAddItem: StatusOverviewProps["onAddItem"],
  expand: (key: string) => void,
): StatusOverviewProps["onAddItem"] {
  if (!onAddItem) return undefined;
  return (target): void => {
    expand(`${target.unitKind}:${target.unitId}`);
    onAddItem(target);
  };
}

export function StatusOverview({
  model,
  onEditItem,
  onQuickEditText,
  onAddItem,
  onResolvePlan,
  onRestorePlan,
  detailsHref,
  autosaveStatus,
  editorSlot,
  health,
}: StatusOverviewProps) {
  const idPrefix = useId();
  const { closeInspection, healthPanelId, inspection, setInspection } =
    useHealthInspection(idPrefix);
  const [activeColumn, setActiveColumn] =
    useState<StatusOverviewColumnKey>("currentWeek");
  const displayedColumn = resolveDisplayedColumn(activeColumn, editorSlot);
  const lineage = buildStatusOverviewLineage(model.units);
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const addItem = buildAddItemHandler(onAddItem, (key) => {
    setExpandedKeys((current) => new Set([...current, key]));
  });
  const toggle = (key: string): void => {
    if (editorSlot?.unitKey === key) return;
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
          <h2
            id={`${idPrefix}-heading`}
            tabIndex={-1}
            data-overview-focus-heading
            className="text-xl font-semibold tracking-[-0.02em] text-[var(--color-foreground)]"
          >
            Status overview
          </h2>
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
              Risks &amp; decisions
            </a>
          ) : null}
        </div>
      </div>

      {health ? (
        <ReportHealthPulseView
          health={health}
          onInspect={(key, opener) => setInspection({ key, opener })}
        />
      ) : null}

      <div
        role="group"
        aria-label="Displayed week"
        className="mb-3 flex flex-wrap gap-1 md:hidden"
      >
        {STATUS_OVERVIEW_COLUMNS.map((column) => (
          <button
            key={column.key}
            type="button"
            aria-pressed={displayedColumn === column.key}
            disabled={Boolean(editorSlot) && displayedColumn !== column.key}
            onClick={() => setActiveColumn(column.key)}
            className={`min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50 ${displayedColumn === column.key ? "bg-[var(--color-toggle-active)] text-[var(--color-primary-foreground)]" : "text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"}`}
          >
            {column.label}
          </button>
        ))}
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
          {UNIT_GROUPS.map((group) => {
            const units = model.units.filter(
              (unit) => unit.kind === group.kind,
            );
            if (units.length === 0) return null;
            const groupId = `${idPrefix}-${group.kind}-heading`;
            return (
              <section
                key={group.kind}
                aria-labelledby={groupId}
                className="border-t border-[var(--color-border-subtle)] first:border-t-0"
              >
                <div className="flex items-center justify-between gap-3 bg-[var(--color-surface-muted)] px-4 py-2">
                  <h3
                    id={groupId}
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-foreground)]"
                  >
                    {group.label}
                  </h3>
                  <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
                    {units.length}
                  </span>
                </div>
                {units.map((unit, index) => {
                  return (
                    <StatusOverviewUnitRow
                      key={unit.key}
                      unit={unit}
                      health={health?.units.find(
                        (entry) => entry.key === unit.key,
                      )}
                      healthPanelId={healthPanelId}
                      healthExpanded={inspection?.key === unit.key}
                      onInspect={(key, opener) =>
                        setInspection({ key, opener })
                      }
                      onCloseHealth={closeInspection}
                      rows={lineage.get(unit.key) ?? []}
                      periods={model.periods}
                      expanded={expandedKeys.has(unit.key)}
                      activeColumn={displayedColumn}
                      onToggle={() => toggle(unit.key)}
                      panelId={`${idPrefix}-${group.kind}-${String(index)}`}
                      onEditItem={onEditItem}
                      onAddItem={addItem}
                      onQuickEditText={onQuickEditText}
                      onResolvePlan={onResolvePlan}
                      onRestorePlan={onRestorePlan}
                      editorSlot={
                        editorSlot?.unitKey === unit.key
                          ? editorSlot
                          : undefined
                      }
                    />
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
