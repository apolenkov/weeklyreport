"use client";

import type { KpiData } from "../model/dashboard";

interface KpiCardsProps {
  readonly data: KpiData;
}

const PERCENT_MAX = 100;

const KPI_CARD_CLASS =
  "flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-card-elevated)]";
const KPI_CAPTION_CLASS =
  "text-xs font-medium text-[var(--color-muted-foreground)]";

function SubmissionsCard({
  submitted,
  total,
  pendingCount,
}: {
  readonly submitted: number;
  readonly total: number;
  readonly pendingCount: number;
}) {
  const submissionPercent =
    total > 0 ? Math.round((submitted / total) * PERCENT_MAX) : 0;

  return (
    <section
      className={KPI_CARD_CLASS}
      style={{ borderLeft: "3px solid var(--color-starbucks-accent)" }}
      aria-label={`Submissions: ${submitted} of ${total}, ${pendingCount} pending`}
    >
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--color-starbucks-accent) 0% ${submissionPercent}%, var(--color-border) ${submissionPercent}% 100%)`,
        }}
        title={`${submitted} of ${total} leads submitted this week (${submissionPercent}%)`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-card)]">
          <span className="font-[family-name:var(--font-sans)] text-xs font-bold leading-none text-[var(--color-primary)]">
            {submitted}/{total}
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <p className={KPI_CAPTION_CLASS}>Submissions</p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-status-at-risk-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-status-at-risk-fg)]">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function DeadlineCard({
  deadlineLabel,
  deadlineTime,
}: {
  readonly deadlineLabel: string;
  readonly deadlineTime: string;
}) {
  return (
    <section
      className={KPI_CARD_CLASS}
      style={{ borderLeft: "3px solid var(--color-warning)" }}
      aria-label={`Deadline: ${deadlineLabel}, ${deadlineTime}`}
    >
      <div className="min-w-0">
        <p className={KPI_CAPTION_CLASS}>Deadline</p>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-[family-name:var(--font-sans)] text-xl font-bold leading-none text-[var(--color-foreground)]">
            {deadlineLabel}
          </span>
          <span className="text-[13px] text-[var(--color-muted-foreground)]">
            {deadlineTime}
          </span>
        </div>
      </div>
    </section>
  );
}

function RiskStat({
  count,
  countClassName,
  label,
}: {
  readonly count: number;
  readonly countClassName: string;
  readonly label: string;
}) {
  return (
    <span className="whitespace-nowrap">
      <span className={countClassName}>{count}</span>
      <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
        {label}
      </span>
    </span>
  );
}

function RisksCard({
  blockedCount,
  atRiskCount,
  decisionCount,
}: {
  readonly blockedCount: number;
  readonly atRiskCount: number;
  readonly decisionCount: number;
}) {
  return (
    <section
      className={KPI_CARD_CLASS}
      style={{ borderLeft: "3px solid var(--color-destructive)" }}
      aria-label={`Risks: ${blockedCount} blocked, ${atRiskCount} at risk, ${decisionCount} decisions`}
    >
      <div className="min-w-0">
        <p className={KPI_CAPTION_CLASS}>Risks &amp; Blockers</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <RiskStat
            count={blockedCount}
            countClassName="text-lg font-bold tabular-nums text-[var(--color-destructive)]"
            label="blocked"
          />
          <RiskStat
            count={atRiskCount}
            countClassName="text-lg font-bold tabular-nums text-[var(--color-status-at-risk-fg)]"
            label="at risk"
          />
          <RiskStat
            count={decisionCount}
            countClassName="text-lg font-bold tabular-nums text-[var(--color-primary)]"
            label="decisions"
          />
        </div>
      </div>
    </section>
  );
}

// Slim horizontal strip so three signals sit above content without tall cards.
export function KpiCards({ data }: KpiCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SubmissionsCard
        submitted={data.submitted}
        total={data.total}
        pendingCount={data.pendingCount}
      />
      <DeadlineCard
        deadlineLabel={data.deadlineLabel}
        deadlineTime={data.deadlineTime}
      />
      <RisksCard
        blockedCount={data.blockedCount}
        atRiskCount={data.atRiskCount}
        decisionCount={data.decisionCount}
      />
    </div>
  );
}
