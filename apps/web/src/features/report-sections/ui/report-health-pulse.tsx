import type { MouseEvent } from "react";

import { countLabel } from "../../../shared/lib/format/pluralize";
import { SlideStatusBadge } from "../../../shared/ui/feedback/slide-status-badge";
import type {
  ReportHealthPulse,
  ReportHealthUnit,
} from "../model/report-health-pulse";

export type OpenHealthDetail = (key: string, opener: HTMLButtonElement) => void;

const NOT_PROVIDED = "Not provided";

export function healthLocations(unit: ReportHealthUnit): string {
  const problems = unit.stages.filter(
    (stage) => stage.status === "blocked" || stage.status === "at-risk",
  );
  const labels = [
    problems.map((stage) => stage.name).join(", "),
    unit.missingStages.length > 0
      ? `Not reported: ${unit.missingStages.join(", ")}`
      : "",
  ].filter(Boolean);
  if (labels.length > 0) return labels.join(" · ");
  if (unit.status === "empty") return "Status not reported";
  return "";
}

export function ReportHealthPulseView({
  health,
  onInspect,
}: {
  readonly health: ReportHealthPulse;
  readonly onInspect: OpenHealthDetail;
}) {
  const attention = health.units.filter(
    (unit) =>
      !unit.historical &&
      (unit.status === "blocked" ||
        unit.status === "at-risk" ||
        unit.status === "empty" ||
        unit.missingStages.length > 0),
  );
  return (
    <section
      aria-label="Report health"
      className="mb-5 min-w-0 rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-card)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-[var(--color-foreground)]">
          Report health
        </h3>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {countLabel(
            health.total,
            "current reporting unit",
            "current reporting units",
          )}{" "}
          · Products and activities
        </p>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        {health.blocked} blocked · {health.atRisk} at risk · {health.missing}{" "}
        with missing status
      </p>
      {attention.length > 0 ? (
        <ul className="mt-3 grid min-w-0 gap-2 lg:grid-cols-2">
          {attention.map((unit) => (
            <li key={unit.key} className="min-w-0">
              <button
                type="button"
                onClick={(event: MouseEvent<HTMLButtonElement>) =>
                  onInspect(unit.key, event.currentTarget)
                }
                className="flex min-h-[var(--touch-target-min)] w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-3 py-2 text-left hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                aria-label={`Inspect health for ${unit.name}`}
              >
                <span className="min-w-0 flex-1 break-words">
                  <span className="block text-sm font-semibold text-[var(--color-primary)]">
                    {unit.name}
                  </span>
                  {healthLocations(unit) ? (
                    <span className="block text-xs text-[var(--color-muted-foreground)]">
                      {healthLocations(unit)}
                    </span>
                  ) : null}
                </span>
                <SlideStatusBadge status={unit.status} labelVariant="screen" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          {health.total === 0
            ? "No current reporting units."
            : "No blocked, at-risk or missing statuses reported."}
        </p>
      )}
      <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
        Select any unit name below to inspect its health. Missing status can
        overlap with a problem. Status changes come from Risks &amp; Blockers.
      </p>
    </section>
  );
}

export function ReportHealthDetail({
  unit,
  panelId,
  onClose,
}: {
  readonly unit: ReportHealthUnit;
  readonly panelId: string;
  readonly onClose: () => void;
}) {
  return (
    <section
      id={panelId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      aria-label={`Health details for ${unit.name}`}
      className="m-3 min-w-0 scroll-mt-24 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="break-words font-semibold">
            {unit.name} · Health details
          </h4>
          <div className="mt-2">
            <SlideStatusBadge status={unit.status} labelVariant="screen" />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          Close health details
        </button>
      </div>
      {unit.historical ? (
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          Historical unit. Not counted in current report health.
        </p>
      ) : null}
      {unit.stages.length > 0 ? (
        <ul
          aria-label={`All stages for ${unit.name}`}
          className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {unit.stages.map((stage) => (
            <li
              key={stage.name}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] p-2 text-sm"
            >
              <span className="min-w-0 break-words">{stage.name}</span>
              <SlideStatusBadge status={stage.status} labelVariant="screen" />
            </li>
          ))}
        </ul>
      ) : null}
      {unit.kind === "activity" ? (
        <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
          Activity health is independent of linked products.
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        <h5 className="text-sm font-semibold">Risks &amp; Blockers</h5>
        {unit.risks.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No risk details available for this unit.
          </p>
        ) : (
          unit.risks.map((risk) => (
            <div
              key={risk.id}
              className="min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-card)] p-3"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <SlideStatusBadge
                  status={risk.severity}
                  labelVariant="screen"
                />
                <span className="break-words text-xs text-[var(--color-muted-foreground)]">
                  {risk.locations.join(", ")}
                </span>
              </div>
              <dl className="space-y-2 break-words text-sm">
                <div>
                  <dt className="font-semibold">Cause</dt>
                  <dd className="whitespace-pre-wrap">
                    {risk.description || NOT_PROVIDED}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Impact</dt>
                  <dd className="whitespace-pre-wrap">
                    {risk.impact || NOT_PROVIDED}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Mitigation</dt>
                  <dd className="whitespace-pre-wrap">
                    {risk.mitigation || NOT_PROVIDED}
                  </dd>
                </div>
              </dl>
            </div>
          ))
        )}
      </div>
      <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
        Read-only inspection. Manage causes and mitigation in Risks &amp;
        Blockers below.
      </p>
    </section>
  );
}
