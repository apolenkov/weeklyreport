"use client";

import Link from "next/link";

import { joinPeriodLabel } from "../../../shared/lib/format/format-date";
import type { HistoryEntry } from "../../report-sections";

interface LeadHistoryListProps {
  readonly entries: readonly HistoryEntry[];
}

function TrafficDot({
  label,
  count,
  className,
}: {
  readonly label: string;
  readonly count: number;
  readonly className: string;
}) {
  return (
    <span
      role="img"
      className="inline-flex h-7 min-w-12 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-card)_70%,transparent)] px-2 text-[12px] font-semibold text-[var(--color-foreground)]"
      aria-label={`${label}: ${count}`}
    >
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {count}
    </span>
  );
}

function StatusBadge({ status }: { readonly status: HistoryEntry["status"] }) {
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
        Submitted
      </span>
    );
  }
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
        Published
      </span>
    );
  }
  if (status === "archived") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-[var(--color-primary-foreground)]">
        Archived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-status-at-risk-bg)] px-3 py-1 text-xs font-semibold text-[var(--color-status-at-risk-fg)]">
      Draft
    </span>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function describeHealth(lights: HistoryEntry["trafficLights"]) {
  if (lights.green > 0 && lights.yellow === 0 && lights.red === 0) {
    return "All green";
  }
  const statusParts = [
    lights.green > 0
      ? formatCount(lights.green, "green status", "green statuses")
      : null,
    lights.yellow > 0
      ? formatCount(lights.yellow, "yellow status", "yellow statuses")
      : null,
    lights.red > 0
      ? formatCount(lights.red, "red status", "red statuses")
      : null,
  ].filter(Boolean);

  return statusParts.length > 0 ? statusParts.join(", ") : "No statuses";
}

function buildHistorySummary(entry: HistoryEntry) {
  const scopeParts = [
    entry.itemCount > 0 ? formatCount(entry.itemCount, "item") : null,
    entry.riskCount > 0 ? formatCount(entry.riskCount, "risk") : null,
    entry.decisionCount > 0
      ? formatCount(entry.decisionCount, "decision")
      : null,
  ].filter(Boolean);

  return [describeHealth(entry.trafficLights), ...scopeParts].join(" | ");
}

function TimelineRow({
  label,
  value,
  muted = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-[12px]">
      <span className="shrink-0 text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <span
        className={
          muted
            ? "min-w-0 truncate text-right text-[var(--color-muted-foreground)]"
            : "min-w-0 truncate text-right font-medium text-[var(--color-foreground)]"
        }
      >
        {value}
      </span>
    </div>
  );
}

function HistoryTimeline({ entry }: { readonly entry: HistoryEntry }) {
  return (
    <div className="mt-4 space-y-1.5 border-t border-[var(--color-border-subtle)] pt-3">
      {entry.createdAt && (
        <TimelineRow label="Created" value={entry.createdAt} />
      )}
      {entry.lastEditAt && (
        <TimelineRow label="Last edit" value={entry.lastEditAt} />
      )}
      {entry.submissionState === "submitted" && entry.submittedAt ? (
        <TimelineRow label="Submitted" value={entry.submittedAt} />
      ) : entry.submissionState === "not-submitted" ? (
        <TimelineRow label="Submitted" value="Not submitted" muted />
      ) : null}
      {entry.publishedAt ? (
        <TimelineRow label="Published" value={entry.publishedAt} />
      ) : null}
    </div>
  );
}

function HistoryCard({ entry }: { readonly entry: HistoryEntry }) {
  return (
    <Link
      // card clicks land on the addressed URL so the browser tab can be
      // bookmarked and shared. `entry.periodId` already maps to the
      // report id via mapHistoryEntries.
      href={entry.href ?? `/lead/report/${entry.periodId}`}
      className="card-surface card-surface-hover group block p-5 transition-[box-shadow,border-color,background-color]"
      // 3px tealA left strip gives submitted reports the same visual
      // anchor as kanban current-week cards, so the history page reads as
      // a continuation of the form.
      style={{
        textDecoration: "none",
        color: "inherit",
        borderLeft: "3px solid var(--color-starbucks-accent)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-foreground)]">
          {joinPeriodLabel(entry.weekLabel, entry.dateRange)}
        </span>
        <StatusBadge status={entry.archived ? "archived" : entry.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TrafficDot
          label="Green statuses"
          count={entry.trafficLights.green}
          className="bg-[var(--color-starbucks-accent)]"
        />
        <TrafficDot
          label="Yellow statuses"
          count={entry.trafficLights.yellow}
          className="bg-[var(--color-status-dot-at-risk)]"
        />
        <TrafficDot
          label="Red statuses"
          count={entry.trafficLights.red}
          className="bg-[var(--color-destructive)]"
        />
      </div>

      <p className="mt-3 line-clamp-2 text-[13px] leading-5 text-[var(--color-muted-foreground)]">
        {buildHistorySummary(entry)}
      </p>

      <HistoryTimeline entry={entry} />
    </Link>
  );
}

export function LeadHistoryList({ entries }: LeadHistoryListProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No past submissions yet. Your submitted reports will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {entries.map((entry) => (
        <HistoryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
