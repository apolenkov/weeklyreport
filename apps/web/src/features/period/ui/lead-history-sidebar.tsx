"use client";

import type { HistoryEntry } from "../../report-sections";

interface LeadHistorySidebarProps {
  readonly entries: readonly HistoryEntry[];
  readonly summaryTitle?: string;
  readonly showStatus?: boolean;
  // Head/viewer surfaces use third-person copy for another person's section.
  readonly viewerMode?: boolean;
}

// Completed for stats: lead "submitted" or compiled "published"/"archived"
// (compiled history never carries "submitted" — see mapCompiledHistoryEntries).
const COMPLETED_WEEK_STATUSES: ReadonlySet<HistoryEntry["status"]> = new Set([
  "submitted",
  "published",
  "archived",
]);
function isCompletedWeek(entry: HistoryEntry): boolean {
  return COMPLETED_WEEK_STATUSES.has(entry.status);
}

const PERCENT_MAX = 100;

type HistoryStats = ReturnType<typeof deriveHistoryStats>;

// Aggregates cover COMPLETED weeks only, so a half-filled draft never dilutes
// the averages the rail advertises.
function deriveHistoryStats(entries: readonly HistoryEntry[]) {
  const total = entries.length;
  const submittedEntries = entries.filter(isCompletedWeek);
  const submitted = submittedEntries.length;
  const sum = (pick: (entry: HistoryEntry) => number): number =>
    submittedEntries.reduce((acc, entry) => acc + pick(entry), 0);

  // Pattern: longest run of consecutive submitted weeks at the top of the list
  // (entries are newest-first per `mapHistoryEntries`). Captures "current
  // streak" — the number that matters at a glance.
  const firstIncompleteIndex = entries.findIndex((e) => !isCompletedWeek(e));

  return {
    total,
    submitted,
    onTimeRate: total === 0 ? 0 : Math.round((submitted / total) * PERCENT_MAX),
    draftCount: total - submitted,
    totalGreen: sum((e) => e.trafficLights.green),
    totalYellow: sum((e) => e.trafficLights.yellow),
    totalRed: sum((e) => e.trafficLights.red),
    totalRisks: sum((e) => e.riskCount),
    avgItems:
      submitted === 0 ? 0 : Math.round(sum((e) => e.itemCount) / submitted),
    streak: firstIncompleteIndex === -1 ? total : firstIncompleteIndex,
  };
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
        <SummaryCard title={summaryTitle} stats={stats} />
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
}: {
  readonly title: string;
  readonly stats: HistoryStats;
}) {
  const { submitted, total, onTimeRate, avgItems, totalRisks, draftCount } =
    stats;
  return (
    <SidebarCard title={title}>
      <StatGrid>
        <Stat
          label="Submissions"
          value={`${submitted}/${total}`}
          accent="primary"
        />
        <Stat
          label="Completion rate"
          value={`${onTimeRate}%`}
          accent="primary"
        />
        <Stat
          label="Avg items / week"
          value={avgItems > 0 ? `${avgItems}` : "—"}
        />
        <Stat
          label="Total risks"
          value={totalRisks > 0 ? `${totalRisks}` : "—"}
          accent={totalRisks > 0 ? "warn" : "muted"}
        />
      </StatGrid>
      {draftCount > 0 && (
        <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
          {draftCount} {draftCount === 1 ? "draft" : "drafts"} not included in
          aggregates.
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
    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[var(--color-starbucks-accent)]" />{" "}
        {totalGreen}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[var(--color-status-dot-at-risk)]" />{" "}
        {totalYellow}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[var(--color-destructive)]" />{" "}
        {totalRed}
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
        Submitted <strong>{streak}</strong> weeks in a row.
      </p>
    );
  }
  if (streak === 1) {
    return (
      <p className="text-[13px] text-[var(--color-foreground)]">
        Last week submitted. {!viewerMode && "Keep the streak going."}
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
        ? "Most recent week is still a draft."
        : "Most recent week is still a draft. Submit to extend your streak."}
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
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
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
    <div className="rounded-md bg-[var(--color-priority-row-bg)] px-3 py-2">
      <div
        className="font-[family-name:var(--font-sans)] text-lg font-semibold leading-none tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
        {label}
      </div>
    </div>
  );
}
