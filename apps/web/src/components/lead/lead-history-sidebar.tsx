'use client';

import type { HistoryEntry } from '../../lib/mappers';

type LeadHistorySidebarProps = {
  readonly entries: ReadonlyArray<HistoryEntry>;
};

/**
 * HIST-2 (Phase 33-04): right-rail companion for the lead history page.
 * Mockup s9 specs three stacked cards — Reporting Overview, Recent Pattern,
 * Quick Filters — that turn the history page from a flat archive into a
 * working surface. We ship the first two (stats + pattern); Quick Filters
 * are deferred until the parent page owns filter state worth wiring.
 *
 * All numbers are derived from `entries` so the sidebar stays a pure
 * presentational fork of the same query result the list uses.
 */
export function LeadHistorySidebar({ entries }: LeadHistorySidebarProps) {
  const total = entries.length;
  const submitted = entries.filter((e) => e.status === 'submitted').length;
  const onTimeRate = total === 0 ? 0 : Math.round((submitted / total) * 100);
  const totalGreen = entries.reduce((acc, e) => acc + e.trafficLights.green, 0);
  const totalYellow = entries.reduce((acc, e) => acc + e.trafficLights.yellow, 0);
  const totalRed = entries.reduce((acc, e) => acc + e.trafficLights.red, 0);
  const totalRisks = entries.reduce((acc, e) => acc + e.riskCount, 0);
  const avgItems = total === 0 ? 0 : Math.round(entries.reduce((a, e) => a + e.itemCount, 0) / total);

  // Pattern: longest run of consecutive submitted weeks at the top of the list
  // (entries are newest-first per `mapHistoryEntries`). Captures "current
  // streak" — the number that matters at a glance.
  let streak = 0;
  for (const e of entries) {
    if (e.status === 'submitted') streak++;
    else break;
  }

  return (
    <aside aria-label="Reporting overview">
      <div className="space-y-4">
        <SidebarCard title="Reporting Overview">
          <StatGrid>
            <Stat label="Submissions" value={`${submitted}/${total}`} accent="primary" />
            <Stat label="On-time rate" value={`${onTimeRate}%`} accent="primary" />
            <Stat label="Avg items / week" value={avgItems > 0 ? `${avgItems}` : '—'} />
            <Stat label="Total risks" value={totalRisks > 0 ? `${totalRisks}` : '—'} accent={totalRisks > 0 ? 'warn' : 'muted'} />
          </StatGrid>
          {/* Traffic-light footer — same colors as the row chips so the rail
              reads as an aggregate of the cards beside it. */}
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--color-starbucks-accent)]" /> {totalGreen}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#d4a017]" /> {totalYellow}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--color-destructive)]" /> {totalRed}
            </span>
            <span className="ml-auto">across {total} {total === 1 ? 'period' : 'periods'}</span>
          </div>
        </SidebarCard>

        <SidebarCard title="Recent Pattern">
          {streak >= 2 ? (
            <p className="text-[13px] text-[var(--color-foreground)]">
              Submitted <strong>{streak}</strong> {streak === 1 ? 'week' : 'weeks'} in a row.
            </p>
          ) : streak === 1 ? (
            <p className="text-[13px] text-[var(--color-foreground)]">
              Last week submitted. Keep the streak going.
            </p>
          ) : total === 0 ? (
            <p className="text-[13px] text-[var(--color-muted-foreground)]">
              No history yet — your first submission lands here.
            </p>
          ) : (
            <p className="text-[13px] text-[var(--color-foreground)]">
              Most recent week is still a draft. Submit to extend your streak.
            </p>
          )}
          {totalRed > 0 && (
            <p className="mt-2 text-[12px] text-[var(--color-muted-foreground)]">
              {totalRed} blocked traffic-light{totalRed === 1 ? '' : 's'} across history — review the affected periods for repeat patterns.
            </p>
          )}
        </SidebarCard>
      </div>
    </aside>
  );
}

function SidebarCard({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <div
      className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-[var(--color-card)] p-4 shadow-[0_0_0.5px_0_rgba(0,0,0,0.06),0_4px_10px_-8px_rgba(0,0,0,0.18)]"
    >
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
        {title}
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
  accent = 'foreground',
}: {
  readonly label: string;
  readonly value: string;
  readonly accent?: 'foreground' | 'primary' | 'warn' | 'muted';
}) {
  const valueColor =
    accent === 'primary'
      ? 'var(--color-starbucks-accent)'
      : accent === 'warn'
      ? '#8a6d1b'
      : accent === 'muted'
      ? 'var(--color-muted-foreground)'
      : 'var(--color-foreground)';
  return (
    <div className="rounded-md bg-[#faf6ee] px-3 py-2">
      <div
        className="font-[family-name:var(--font-sans)] text-lg font-semibold leading-none tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">{label}</div>
    </div>
  );
}
