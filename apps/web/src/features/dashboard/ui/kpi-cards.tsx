"use client";

import type { KpiData } from "../model/dashboard";

interface KpiCardsProps {
  readonly data: KpiData;
}

const PERCENT_MAX = 100;

// Compact single-row KPI strip. Each metric is one horizontal card so the three
// signals (Submissions / Deadline / Risks & Blockers) read as a slim status bar
// above the dashboard rather than three tall cards that push the real content
// down. Same signal, far less vertical space; the accent left-rail and the
// submission ring stay as the recognisable at-a-glance cues.
export function KpiCards({ data }: KpiCardsProps) {
  const submissionPercent =
    data.total > 0
      ? Math.round((data.submitted / data.total) * PERCENT_MAX)
      : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {/* Submissions */}
      <section
        className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
        style={{ borderLeft: "3px solid var(--color-starbucks-accent)" }}
        aria-label={`Submissions: ${data.submitted} of ${data.total}, ${data.pendingCount} pending`}
      >
        {/* Conic gradient ring */}
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--color-starbucks-accent) 0% ${submissionPercent}%, var(--color-border) ${submissionPercent}% 100%)`,
          }}
          title={`${data.submitted} of ${data.total} leads submitted this week (${submissionPercent}%)`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
            <span className="font-[family-name:var(--font-sans)] text-[11px] font-bold leading-none text-[var(--color-primary)]">
              {data.submitted}/{data.total}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
            Submissions
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] tabular-nums text-[var(--color-muted-foreground)]">
              Last week {data.lastWeekSubmitted}/{data.lastWeekTotal}
            </span>
            {data.pendingCount > 0 && (
              <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-status-at-risk-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-status-at-risk-fg)]">
                {data.pendingCount} pending
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Deadline */}
      <section
        className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
        style={{ borderLeft: "3px solid var(--color-warning)" }}
        aria-label={`Deadline: ${data.deadlineLabel}, ${data.deadlineTime}`}
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
            Deadline
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-[family-name:var(--font-sans)] text-xl font-bold leading-none text-[var(--color-foreground)]">
              {data.deadlineLabel}
            </span>
            <span className="text-[13px] text-[var(--color-muted-foreground)]">
              {data.deadlineTime}
            </span>
          </div>
        </div>
      </section>

      {/* Risks & Blockers */}
      <section
        className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
        style={{ borderLeft: "3px solid var(--color-destructive)" }}
        aria-label={`Risks: ${data.blockedCount} blocked, ${data.atRiskCount} at risk, ${data.decisionCount} decisions`}
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
            Risks &amp; Blockers
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="whitespace-nowrap">
              <span className="text-lg font-bold tabular-nums text-[var(--color-destructive)]">
                {data.blockedCount}
              </span>
              <span className="ml-1 text-[11px] text-[var(--color-muted-foreground)]">
                blocked
              </span>
            </span>
            <span className="whitespace-nowrap">
              <span className="text-lg font-bold tabular-nums text-[var(--color-status-at-risk-fg)]">
                {data.atRiskCount}
              </span>
              <span className="ml-1 text-[11px] text-[var(--color-muted-foreground)]">
                at risk
              </span>
            </span>
            <span className="whitespace-nowrap">
              <span className="text-lg font-bold tabular-nums text-[var(--color-primary)]">
                {data.decisionCount}
              </span>
              <span className="ml-1 text-[11px] text-[var(--color-muted-foreground)]">
                decisions
              </span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
