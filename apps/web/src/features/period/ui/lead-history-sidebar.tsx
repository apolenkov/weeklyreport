"use client";

import type { HistoryEntry } from "../../../lib/mappers";

interface LeadHistorySidebarProps {
  readonly entries: readonly HistoryEntry[];
  readonly summaryTitle?: string;
  readonly showStatus?: boolean;
  /** When true, renders third-person copy (head/viewer looking at someone else's section). */
  readonly viewerMode?: boolean;
}

// A history row counts as a completed week for the summary stats when the lead
// submitted the section ("submitted") OR the compiled report was
// published/archived. The sidebar is shared between the lead personal-history
// view and the head/viewer compiled-history view; compiled entries never carry
// "submitted" (see mapCompiledHistoryEntries), so matching only "submitted"
// left every compiled stat at 0 (driver sweep 2026-06-09).
const COMPLETED_WEEK_STATUSES: ReadonlySet<HistoryEntry["status"]> = new Set([
  "submitted",
  "published",
  "archived",
]);
function isCompletedWeek(entry: HistoryEntry): boolean {
  return COMPLETED_WEEK_STATUSES.has(entry.status);
}

const PERCENT_MAX = 100;

/**
 * HIST-2 (Phase 33-04): right-rail companion for the lead history page.
 * Mockup s9 specs three stacked cards — My History Summary, Submission Status,
 * Quick Filters — that turn the history page from a flat archive into a
 * working surface. We ship the first two (stats + pattern); Quick Filters
 * are deferred until the parent page owns filter state worth wiring.
 *
 * All numbers are derived from `entries` so the sidebar stays a pure
 * presentational fork of the same query result the list uses.
 */
export function LeadHistorySidebar({
  entries,
  summaryTitle = "My History Summary",
  showStatus = true,
  viewerMode = false,
}: LeadHistorySidebarProps) {
  const total = entries.length;
  const submittedEntries = entries.filter(isCompletedWeek);
  const submitted = submittedEntries.length;
  const onTimeRate =
    total === 0 ? 0 : Math.round((submitted / total) * PERCENT_MAX);
  const draftCount = total - submitted;
  const totalGreen = submittedEntries.reduce(
    (acc, e) => acc + e.trafficLights.green,
    0,
  );
  const totalYellow = submittedEntries.reduce(
    (acc, e) => acc + e.trafficLights.yellow,
    0,
  );
  const totalRed = submittedEntries.reduce(
    (acc, e) => acc + e.trafficLights.red,
    0,
  );
  const totalRisks = submittedEntries.reduce((acc, e) => acc + e.riskCount, 0);
  const avgItems =
    submitted === 0
      ? 0
      : Math.round(
          submittedEntries.reduce((a, e) => a + e.itemCount, 0) / submitted,
        );

  // Pattern: longest run of consecutive submitted weeks at the top of the list
  // (entries are newest-first per `mapHistoryEntries`). Captures "current
  // streak" — the number that matters at a glance.
  let streak = 0;
  for (const e of entries) {
    if (isCompletedWeek(e)) streak++;
    else break;
  }

  return (
    <aside aria-label={summaryTitle}>
      <div className="space-y-4">
        <SidebarCard title={summaryTitle}>
          <StatGrid>
            <Stat
              label="Submissions"
              value={`${submitted}/${total}`}
              accent="primary"
            />
            <Stat
              label="On-time rate"
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
              {draftCount} {draftCount === 1 ? "draft" : "drafts"} not included
              in aggregates.
            </p>
          )}
          {/* Traffic-light footer — same colors as the row chips so the rail
              reads as an aggregate of the cards beside it. */}
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
            {/* Denominator counts only the completed periods these
                traffic-light sums are computed from (submittedEntries), so the
                numerator and denominator describe the same set. A draft, when
                present, is disclosed by the "N draft not included" note above,
                not folded into this count. */}
            <span className="ml-auto">
              across {submitted} {submitted === 1 ? "period" : "periods"}
            </span>
          </div>
        </SidebarCard>

        {showStatus && (
          <SidebarCard title="Submission Status">
            {streak >= 2 ? (
              <p className="text-[13px] text-[var(--color-foreground)]">
                Submitted <strong>{streak}</strong>{" "}
                {streak === 1 ? "week" : "weeks"} in a row.
              </p>
            ) : streak === 1 ? (
              <p className="text-[13px] text-[var(--color-foreground)]">
                Last week submitted. {!viewerMode && "Keep the streak going."}
              </p>
            ) : total === 0 ? (
              <p className="text-[13px] text-[var(--color-muted-foreground)]">
                {viewerMode
                  ? "No history yet."
                  : "No history yet — your first submission lands here."}
              </p>
            ) : (
              <p className="text-[13px] text-[var(--color-foreground)]">
                {viewerMode
                  ? "Most recent week is still a draft."
                  : "Most recent week is still a draft. Submit to extend your streak."}
              </p>
            )}
            {totalRed > 0 && (
              <p className="mt-2 text-[12px] text-[var(--color-muted-foreground)]">
                {totalRed} blocked traffic-light
                {totalRed === 1 ? "" : "s"} across history — review the affected
                periods for repeat patterns.
              </p>
            )}
          </SidebarCard>
        )}
      </div>
    </aside>
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
    <div className="rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-card)] p-4 shadow-[0_0_0.5px_0_rgba(0,0,0,0.06),0_4px_10px_-8px_rgba(0,0,0,0.18)]">
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
    <div className="rounded-md bg-[#faf6ee] px-3 py-2">
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
