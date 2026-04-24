'use client';

import Link from 'next/link';

import type { HistoryEntry } from './mock-data';

type LeadHistoryListProps = {
  readonly entries: HistoryEntry[];
};

function TrafficDot({ color, count }: { readonly color: string; readonly count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="inline-flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center rounded-full text-[8px] font-extrabold text-white"
          style={{ background: color }}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { readonly status: 'submitted' | 'draft' }) {
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
        Submitted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[#fef3c7] px-3 py-1 text-xs font-semibold text-[#8a6d1b]">
      Draft
    </span>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-shrink-0" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <Link
          key={entry.id}
          href={`/lead/report?period=${entry.periodId}`}
          className="group block overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_12px_26px_-18px_rgba(0,0,0,0.22),0_2px_4px_rgba(0,0,0,0.06)]"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-foreground)]">
              {entry.weekLabel}
            </span>
            <StatusBadge status={entry.status} />
          </div>

          {/* Date range */}
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {entry.dateRange}
          </p>

          {/* Traffic lights */}
          <div className="mt-3 flex items-center gap-2">
            <TrafficDot color="var(--color-starbucks-accent)" count={entry.trafficLights.green} />
            <TrafficDot color="#d4a017" count={entry.trafficLights.yellow} />
            <TrafficDot color="var(--color-destructive)" count={entry.trafficLights.red} />
          </div>

          {/* Metrics */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-muted-foreground)]">
            <span>{entry.itemCount} items</span>
            <span>&middot;</span>
            <span>{entry.riskCount} risks</span>
            <span>&middot;</span>
            <span>{entry.decisionCount} decisions</span>
          </div>

          {/* Submitted timestamp */}
          {entry.submittedAt && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
              <ClockIcon />
              <span>Submitted {entry.submittedAt}</span>
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
