"use client";

import { useEffect, useId, useState } from "react";

import { buildStatusOverviewLineage } from "../model/status-overview-lineage";
import { ReportHealthPulseView } from "./report-health-pulse";
import { STATUS_OVERVIEW_COLUMN_HEADER_IDS } from "./status-overview-layout";
import type { StatusOverviewProps } from "./status-overview-props";
import { STATUS_OVERVIEW_DESKTOP_GRID } from "./status-overview-row";
import { UNIT_GROUPS, UnitGroup } from "./status-overview-unit-group";

export type { StatusOverviewProps } from "./status-overview-props";

function ColumnHeading({
  id,
  label,
  period,
}: {
  readonly id: string;
  readonly label: string;
  readonly period: string | null;
}) {
  return (
    <div
      id={id}
      className="min-w-0 border-l border-[var(--color-border-subtle)] px-4 pb-3"
    >
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs text-[var(--color-foreground)]">
        {period ?? "Period unavailable"}
      </p>
    </div>
  );
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

function StatusOverviewHeader({
  idPrefix,
  previousPlanSource,
  autosaveStatus,
  detailsHref,
  onConfirmAll,
}: {
  readonly idPrefix: string;
  readonly onConfirmAll: (() => void) | undefined;
  readonly previousPlanSource: StatusOverviewProps["model"]["previousPlanSource"];
  readonly autosaveStatus: StatusOverviewProps["autosaveStatus"];
  readonly detailsHref: StatusOverviewProps["detailsHref"];
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-6 md:border-b md:border-[var(--color-border-subtle)] md:pb-4">
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
        {previousPlanSource ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            Prior plan: {previousPlanSource}
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
        {onConfirmAll ? (
          <button
            type="button"
            onClick={onConfirmAll}
            className="inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-3 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            Confirm all as continue
          </button>
        ) : null}
        {detailsHref ? (
          <a
            href={detailsHref}
            className="inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-3 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            Risks &amp; decisions
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ColumnHeadings({
  periods,
}: {
  readonly periods: StatusOverviewProps["model"]["periods"];
}) {
  return (
    <div className={`mb-4 hidden ${STATUS_OVERVIEW_DESKTOP_GRID}`}>
      <div />
      <ColumnHeading
        id={STATUS_OVERVIEW_COLUMN_HEADER_IDS.previouslyPlanned}
        label="Previously planned"
        period={periods.previouslyPlanned}
      />
      <ColumnHeading
        id={STATUS_OVERVIEW_COLUMN_HEADER_IDS.currentWeek}
        label="Current week"
        period={periods.currentWeek}
      />
      <ColumnHeading
        id={STATUS_OVERVIEW_COLUMN_HEADER_IDS.nextWeek}
        label="Next week"
        period={periods.nextWeek}
      />
    </div>
  );
}

export function StatusOverview(props: StatusOverviewProps) {
  const { model, onAddItem, detailsHref, autosaveStatus, editorSlot, health } =
    props;
  const idPrefix = useId();
  const { closeInspection, healthPanelId, inspection, setInspection } =
    useHealthInspection(idPrefix);
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
      <StatusOverviewHeader
        idPrefix={idPrefix}
        previousPlanSource={model.previousPlanSource}
        autosaveStatus={autosaveStatus}
        detailsHref={detailsHref}
        onConfirmAll={
          (props.pendingReviewCount ?? 0) > 0 ? props.onConfirmAll : undefined
        }
      />

      {health ? (
        <ReportHealthPulseView
          health={health}
          onInspect={(key, opener) => setInspection({ key, opener })}
        />
      ) : null}

      <ColumnHeadings periods={model.periods} />

      {model.units.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No reporting units are available for this period.
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-[var(--radius)] border-y border-[var(--color-border-subtle)] bg-[var(--color-card)]">
          {UNIT_GROUPS.map((group) => (
            <UnitGroup
              key={group.kind}
              group={group}
              idPrefix={idPrefix}
              overview={props}
              lineage={lineage}
              inspectionKey={inspection?.key}
              healthPanelId={healthPanelId}
              onInspect={(key, opener) => setInspection({ key, opener })}
              onCloseHealth={closeInspection}
              expandedKeys={expandedKeys}
              onToggle={toggle}
              onAddItem={addItem}
            />
          ))}
        </div>
      )}
    </section>
  );
}
