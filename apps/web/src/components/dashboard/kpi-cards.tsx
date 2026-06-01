"use client";

import type { KpiData } from "./mock-data";

interface KpiCardsProps {
  readonly data: KpiData;
}

export function KpiCards({ data }: KpiCardsProps) {
  const submissionPercent = Math.round((data.submitted / data.total) * 100);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Submissions */}
      <section
        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
        style={{ borderLeft: "3px solid var(--color-starbucks-accent)" }}
        aria-label={`Submissions: ${data.submitted} of ${data.total}, ${data.pendingCount} pending`}
      >
        <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
          Submissions
        </p>
        <div className="flex items-center gap-4">
          {/* Conic gradient ring */}
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-starbucks-accent) 0% ${submissionPercent}%, var(--color-border) ${submissionPercent}% 100%)`,
            }}
            title={`${data.submitted} of ${data.total} leads submitted this week (${submissionPercent}%)`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
              <span className="font-[family-name:var(--font-sans)] text-[15px] font-bold leading-none text-[var(--color-primary)]">
                {data.submitted}/{data.total}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[13px] tabular-nums text-[var(--color-muted-foreground)]">
              Last week: {data.lastWeekSubmitted}/{data.lastWeekTotal}
            </div>
            {data.pendingCount > 0 && (
              <div className="mt-1">
                <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold text-[#8a6d1b]">
                  {data.pendingCount} pending
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Deadline */}
      <section
        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
        style={{ borderLeft: "3px solid var(--color-warning)" }}
        aria-label={`Deadline: ${data.deadlineLabel}, ${data.deadlineTime}`}
      >
        <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
          Deadline
        </p>
        <div className="font-[family-name:var(--font-sans)] text-[32px] font-bold leading-none text-[var(--color-starbucks-gold)]">
          {data.deadlineLabel}
        </div>
        <p className="mt-2 text-[13px] text-[var(--color-muted-foreground)]">
          {data.deadlineTime}
        </p>
      </section>

      {/* Risks & Blockers */}
      <section
        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
        style={{ borderLeft: "3px solid var(--color-destructive)" }}
        aria-label={`Risks: ${data.blockedCount} blocked, ${data.atRiskCount} at risk, ${data.decisionCount} decisions`}
      >
        <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
          Risks & Blockers
        </p>
        <div className="flex gap-4">
          <div>
            <span className="font-[family-name:var(--font-sans)] text-[28px] font-bold text-[var(--color-destructive)]">
              {data.blockedCount}
            </span>
            <div className="text-[11px] text-[var(--color-muted-foreground)]">
              Blocked
            </div>
          </div>
          <div>
            <span className="font-[family-name:var(--font-sans)] text-[28px] font-bold text-[var(--color-starbucks-gold)]">
              {data.atRiskCount}
            </span>
            <div className="text-[11px] text-[var(--color-muted-foreground)]">
              At Risk
            </div>
          </div>
          <div>
            <span className="font-[family-name:var(--font-sans)] text-[28px] font-bold text-[var(--color-primary)]">
              {data.decisionCount}
            </span>
            <div className="text-[11px] text-[var(--color-muted-foreground)]">
              Decisions
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
