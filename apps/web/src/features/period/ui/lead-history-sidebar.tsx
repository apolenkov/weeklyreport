"use client";

import type { HistoryEntry } from "../../report-sections";
import {
  deriveHistoryStats,
  type HistoryStats,
} from "./history/lead-history-stats";

interface LeadHistorySidebarProps {
  readonly entries: readonly HistoryEntry[];
  readonly summaryTitle?: string;
  readonly showStatus?: boolean;
  // Head/viewer surfaces use third-person copy for another person's section.
  readonly viewerMode?: boolean;
}

// Every number is derived from `entries`, so the rail stays a pure
// presentational fork of the same query result the list renders — no second
// fetch to keep in sync.
export function LeadHistorySidebar({
  entries,
  summaryTitle = "My History Summary",
  showStatus = true,
  viewerMode = false,
}: LeadHistorySidebarProps) {
  const stats = deriveHistoryStats(entries);

  return (
    <aside aria-label={summaryTitle}>
      <div className="space-y-4">
        <SummaryCard
          title={summaryTitle}
          stats={stats}
          viewerMode={viewerMode}
        />
        {showStatus && (
          <SubmissionStatusCard stats={stats} viewerMode={viewerMode} />
        )}
      </div>
    </aside>
  );
}

function SummaryCard({
  title,
  stats,
  viewerMode,
}: {
  readonly title: string;
  readonly stats: HistoryStats;
  readonly viewerMode: boolean;
}) {
  const {
    submitted,
    total,
    completionRate,
    avgItems,
    totalRisks,
    excludedCount,
  } = stats;
  return (
    <SidebarCard title={title}>
      <StatGrid>
        <Stat
          label={viewerMode ? "Periods completed" : "Submissions"}
          value={`${submitted}/${total}`}
          accent="primary"
        />
        <Stat
          label="Completion rate"
          value={`${completionRate}%`}
          accent="primary"
        />
        <Stat
          label="Avg items / week"
          value={submitted > 0 ? `${avgItems}` : "—"}
        />
        <Stat
          label="Total risks"
          value={`${totalRisks}`}
          accent={totalRisks > 0 ? "warn" : "muted"}
        />
      </StatGrid>
      {excludedCount > 0 && (
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
          {excludedCount} {excludedCount === 1 ? "week" : "weeks"} not included
          in aggregates.
        </p>
      )}
      <TrafficLightFooter stats={stats} />
    </SidebarCard>
  );
}

// Traffic-light footer — same colors as the row chips so the rail
// reads as an aggregate of the cards beside it.
function TrafficLightFooter({ stats }: { readonly stats: HistoryStats }) {
  const { totalGreen, totalYellow, totalRed, submitted } = stats;
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-muted-foreground)]"
      aria-label={`Traffic lights: ${totalGreen} on track, ${totalYellow} at risk, ${totalRed} blocked across ${submitted} ${submitted === 1 ? "period" : "periods"}`}
    >
      <span className="inline-flex items-center gap-1">
        <span
          className="h-2 w-2 rounded-full bg-[var(--color-starbucks-accent)]"
          aria-hidden="true"
        />{" "}
        {totalGreen} on track
      </span>
      <span className="inline-flex items-center gap-1">
        <span
          className="h-2 w-2 rounded-full bg-[var(--color-status-dot-at-risk)]"
          aria-hidden="true"
        />{" "}
        {totalYellow} at risk
      </span>
      <span className="inline-flex items-center gap-1">
        <span
          className="h-2 w-2 rounded-full bg-[var(--color-destructive)]"
          aria-hidden="true"
        />{" "}
        {totalRed} blocked
      </span>
      {/* Denominator is completed periods only (same set as traffic-light sums). */}
      <span className="ml-auto">
        across {submitted} {submitted === 1 ? "period" : "periods"}
      </span>
    </div>
  );
}

function StreakLine({
  streak,
  total,
  viewerMode,
}: {
  readonly streak: number;
  readonly total: number;
  readonly viewerMode: boolean;
}) {
  if (streak >= 2) {
    return (
      <p className="text-[13px] text-[var(--color-foreground)]">
        {viewerMode ? "Completed" : "Submitted"} <strong>{streak}</strong> weeks
        in a row.
      </p>
    );
  }
  if (streak === 1) {
    return (
      <p className="text-[13px] text-[var(--color-foreground)]">
        Most recent period {viewerMode ? "completed." : "submitted."}{" "}
        {!viewerMode && "Keep the streak going."}
      </p>
    );
  }
  if (total === 0) {
    return (
      <p className="text-[13px] text-[var(--color-muted-foreground)]">
        {viewerMode
          ? "No history yet."
          : "No history yet — your first submission lands here."}
      </p>
    );
  }
  return (
    <p className="text-[13px] text-[var(--color-foreground)]">
      {viewerMode
        ? "Most recent period is not completed."
        : "Most recent period is not completed. Submit to extend your streak."}
    </p>
  );
}

function SubmissionStatusCard({
  stats,
  viewerMode,
}: {
  readonly stats: HistoryStats;
  readonly viewerMode: boolean;
}) {
  const { streak, total, totalRed } = stats;
  return (
    <SidebarCard title="Submission Status">
      <StreakLine streak={streak} total={total} viewerMode={viewerMode} />
      {totalRed > 0 && (
        <p className="mt-2 text-[12px] text-[var(--color-muted-foreground)]">
          {totalRed} blocked traffic-light
          {totalRed === 1 ? "" : "s"} across history — review the affected
          periods for repeat patterns.
        </p>
      )}
    </SidebarCard>
  );
}

function SidebarCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-sidebar-card)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function StatGrid({ children }: { readonly children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Stat({
  label,
  value,
  accent = "foreground",
}: {
  readonly label: string;
  readonly value: string;
  readonly accent?: "foreground" | "primary" | "warn" | "muted";
}) {
  const valueColor =
    accent === "primary"
      ? "var(--color-starbucks-accent)"
      : accent === "warn"
        ? "var(--color-status-at-risk-fg)"
        : accent === "muted"
          ? "var(--color-muted-foreground)"
          : "var(--color-foreground)";
  return (
    <div className="flex h-full flex-col justify-between rounded-md bg-[var(--color-priority-row-bg)] px-3 py-2">
      <div
        className="font-[family-name:var(--font-sans)] text-lg font-semibold leading-none tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      <div className="mt-1 text-xs leading-tight text-[var(--color-muted-foreground)]">
        {label}
      </div>
    </div>
  );
}
