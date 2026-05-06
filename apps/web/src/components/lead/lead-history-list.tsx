'use client';

import Link from 'next/link';

import type { HistoryEntry } from '../../lib/mappers';

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
          // 35-07 (UX-15): card clicks land on the addressed URL so the
          // browser tab can be bookmarked and shared. `entry.periodId`
          // already maps to the report id via mapHistoryEntries.
          href={`/lead/report/${entry.periodId}`}
          className="group block overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_12px_26px_-18px_rgba(0,0,0,0.22),0_2px_4px_rgba(0,0,0,0.06)]"
          // HIST-1 (Phase 33-04): 3px tealA left strip per mockup s9 — gives
          // submitted reports the same visual anchor as kanban current-week
          // cards, so the history page reads as a continuation of the form.
          style={{ textDecoration: 'none', color: 'inherit', borderLeft: '3px solid var(--color-starbucks-accent)' }}
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

          {/* Metrics — HIST-4: prefix with assigned-products count when present */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-muted-foreground)]">
            {typeof entry.productCount === 'number' && (
              <>
                <span>{entry.productCount} assigned products</span>
                <span>&middot;</span>
              </>
            )}
            <span>{entry.itemCount} items</span>
            <span>&middot;</span>
            <span>
              {entry.riskCount} risk{entry.riskCount === 1 ? '' : 's'}
            </span>
            <span>&middot;</span>
            <span>{entry.decisionCount} decisions</span>
          </div>

          {/* HIST-5: drop ClockIcon — mockup uses plain text. */}
          {entry.submittedAt && (
            <div className="mt-3 text-[13px] text-[var(--color-muted-foreground)]">
              Submitted {entry.submittedAt}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
