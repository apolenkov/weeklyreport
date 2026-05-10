'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { PeriodListItem, PeriodState } from '@customreport/shared';

import { invalidateAdmin } from '../../lib/cache-keys';
import { useTRPC } from '../../lib/trpc-context';

import { TabHeader } from './tab-header';

/**
 * UFB-052 (Phase 51-B): Admin → Periods tab. Replaces the flat list
 * with a lifecycle-aware two-section layout:
 *
 *   ┌─ Active ────────────────────────────────────────────┐
 *   │  rows with periodState ∈ {scheduled, open, published}│
 *   │  primary panel, always rendered                      │
 *   └─────────────────────────────────────────────────────┘
 *
 *   ┌─ Archive [show ☐] ─────────────────────────────────┐
 *   │  rows with periodState = archived                  │
 *   │  collapsed by default; query is gated (opt-in)     │
 *   └────────────────────────────────────────────────────┘
 *
 * Each row exposes a 3-dot action menu whose items vary by state:
 *
 *   open       → (no admin actions; auto-publisher handles it)
 *   published  → Reopen (gated server-side) · Archive
 *   archived   → Unarchive
 *   scheduled  → (no admin actions; auto-creator advances it)
 *
 * Action visibility is driven by the server-precomputed `canReopen`
 * and `canArchive` flags on `PeriodListItem`, so the UI does not need
 * to replicate the reopen-policy rules from `AppSettings`.
 *
 * `period.publish` and `period.reopen` are existing head-procedures
 * (admin role is aliased to head, so they're callable here). Archive
 * + Unarchive are new admin-procedures from 51-B.
 */
export function PeriodsTab() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  // Archive section is collapsed by default. The query stays disabled
  // until the user opens the section to keep the initial page load to
  // a single round-trip (the active bucket).
  const [showArchive, setShowArchive] = useState(false);

  const activeQuery = useQuery(
    trpc.admin.listPeriodsByState.queryOptions({ bucket: 'active' }),
  );
  const archiveQuery = useQuery({
    ...trpc.admin.listPeriodsByState.queryOptions({ bucket: 'archive' }),
    enabled: showArchive,
  });

  function invalidatePeriodLists() {
    void qc.invalidateQueries(trpc.admin.listPeriodsByState.pathFilter());
    invalidateAdmin(qc, trpc);
  }

  const publishMut = useMutation(
    trpc.period.publish.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success('Period published');
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to publish period');
      },
    }),
  );

  const reopenMut = useMutation(
    trpc.period.reopen.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success('Period reopened');
      },
      onError: (err) => {
        // The 51-B reopen-policy gate (master switch + window) surfaces
        // through `PeriodAccessError → BAD_REQUEST` here; the message
        // already explains *why* the reopen was rejected so we pipe it
        // through verbatim.
        toast.error(err.message ?? 'Failed to reopen period');
      },
    }),
  );

  const archiveMut = useMutation(
    trpc.admin.archivePeriod.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success('Period archived');
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to archive period');
      },
    }),
  );

  const unarchiveMut = useMutation(
    trpc.admin.unarchivePeriod.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success('Period unarchived');
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to unarchive period');
      },
    }),
  );

  const activeRows = (activeQuery.data ?? []) as PeriodListItem[];
  const archiveRows = (archiveQuery.data ?? []) as PeriodListItem[];

  return (
    <div className="space-y-6">
      <TabHeader
        title="Periods"
        description="Reporting periods grouped by lifecycle state."
        count={`${activeRows.length} active`}
      />

      {/* ---- Active section ----------------------------------------- */}
      <section aria-labelledby="periods-active-heading" className="space-y-3">
        <header className="flex items-baseline justify-between">
          <h3
            id="periods-active-heading"
            className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]"
          >
            Active
          </h3>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            scheduled · open · published
          </span>
        </header>

        {activeQuery.isLoading ? (
          <div
            className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]"
            data-testid="periods-active-loading"
          >
            Loading…
          </div>
        ) : activeRows.length === 0 ? (
          <div
            className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]"
            data-testid="periods-active-empty"
          >
            No active periods.
          </div>
        ) : (
          <PeriodTable
            testIdPrefix="active"
            rows={activeRows}
            onPublish={(row) => publishMut.mutate({ reportId: row.id })}
            onReopen={(row) => reopenMut.mutate({ reportId: row.id })}
            onArchive={(row) => archiveMut.mutate({ periodId: row.id })}
            onUnarchive={(row) => unarchiveMut.mutate({ periodId: row.id })}
          />
        )}
      </section>

      {/* ---- Archive section ---------------------------------------- */}
      <section aria-labelledby="periods-archive-heading" className="space-y-3">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowArchive((prev) => !prev)}
            className="flex items-center gap-2 text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-starbucks-accent)]"
            aria-expanded={showArchive}
            aria-controls="periods-archive-body"
            data-testid="periods-archive-toggle"
          >
            <Chevron expanded={showArchive} />
            <span id="periods-archive-heading">Archive</span>
          </button>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            archived
          </span>
        </header>

        {showArchive && (
          <div id="periods-archive-body" data-testid="periods-archive-body">
            {archiveQuery.isLoading ? (
              <div
                className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]"
                data-testid="periods-archive-loading"
              >
                Loading archive…
              </div>
            ) : archiveRows.length === 0 ? (
              <div
                className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]"
                data-testid="periods-archive-empty"
              >
                No archived periods.
              </div>
            ) : (
              <PeriodTable
                testIdPrefix="archive"
                rows={archiveRows}
                onPublish={(row) => publishMut.mutate({ reportId: row.id })}
                onReopen={(row) => reopenMut.mutate({ reportId: row.id })}
                onArchive={(row) => archiveMut.mutate({ periodId: row.id })}
                onUnarchive={(row) => unarchiveMut.mutate({ periodId: row.id })}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------

type PeriodTableProps = {
  readonly rows: PeriodListItem[];
  readonly testIdPrefix: 'active' | 'archive';
  readonly onPublish: (row: PeriodListItem) => void;
  readonly onReopen: (row: PeriodListItem) => void;
  readonly onArchive: (row: PeriodListItem) => void;
  readonly onUnarchive: (row: PeriodListItem) => void;
};

function PeriodTable({
  rows,
  testIdPrefix,
  onPublish,
  onReopen,
  onArchive,
  onUnarchive,
}: PeriodTableProps) {
  return (
    <div
      className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]"
      data-testid={`periods-${testIdPrefix}-table`}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Period
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              State
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Progress
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Deadline
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <PeriodRow
              key={row.id}
              row={row}
              testIdPrefix={testIdPrefix}
              onPublish={onPublish}
              onReopen={onReopen}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodRow({
  row,
  testIdPrefix,
  onPublish,
  onReopen,
  onArchive,
  onUnarchive,
}: {
  readonly row: PeriodListItem;
  readonly testIdPrefix: 'active' | 'archive';
} & Omit<PeriodTableProps, 'rows' | 'testIdPrefix'>) {
  return (
    <tr
      data-testid={`periods-${testIdPrefix}-row-${row.id}`}
      data-period-state={row.periodState}
      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]"
    >
      <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
        {formatRange(row.periodStart, row.periodEnd)}
      </td>
      <td className="px-4 py-3">
        <StateBadge state={row.periodState} />
        {row.periodStatus === 'reopened' && (
          <span
            className="ml-2 inline-flex items-center rounded-[var(--radius-pill)] bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#92400e]"
            data-testid={`periods-row-${row.id}-reopened-badge`}
          >
            reopened
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <ProgressBadge
          submitted={row.submittedCount}
          total={row.totalCount}
          rowId={row.id}
        />
      </td>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
        {formatDate(row.deadline)}
      </td>
      <td className="px-4 py-3 text-right">
        <ActionMenu
          row={row}
          onPublish={onPublish}
          onReopen={onReopen}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
        />
      </td>
    </tr>
  );
}

function StateBadge({ state }: { readonly state: PeriodState }) {
  const styles: Record<PeriodState, { bg: string; text: string; label: string }> = {
    scheduled: { bg: '#e5e7eb', text: '#374151', label: 'scheduled' },
    open: { bg: 'var(--color-success)', text: 'var(--color-primary)', label: 'open' },
    published: { bg: '#e8e0f0', text: '#6b21a8', label: 'published' },
    archived: { bg: '#f3f4f6', text: '#6b7280', label: 'archived' },
  };
  const s = styles[state];
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold capitalize"
      style={{ backgroundColor: s.bg, color: s.text }}
      data-testid={`state-badge-${state}`}
    >
      {s.label}
    </span>
  );
}

/**
 * Progress badge — `<submitted>/<total>` with a 3-tier color scale.
 * Used in the row instead of just a number so heads can scan the
 * lifecycle list and spot the lagging periods at a glance.
 */
function ProgressBadge({
  submitted,
  total,
  rowId,
}: {
  readonly submitted: number;
  readonly total: number;
  readonly rowId: string;
}) {
  // Edge case: total === 0 happens for newly minted periods before the
  // auto-creator provisioned the per-lead sections. Show `—` so the row
  // doesn't claim "0/0 complete" — that would imply 100% and mislead.
  if (total === 0) {
    return (
      <span
        className="text-xs text-[var(--color-muted-foreground)]"
        data-testid={`periods-row-${rowId}-progress`}
      >
        —
      </span>
    );
  }
  const ratio = submitted / total;
  const tone =
    ratio >= 1 ? 'success' : ratio >= 0.5 ? 'amber' : 'red';
  const colors = {
    success: { bg: 'var(--color-success)', text: 'var(--color-primary)' },
    amber: { bg: '#fef3c7', text: '#92400e' },
    red: { bg: '#fee2e2', text: '#991b1b' },
  } as const;
  const c = colors[tone];
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold tabular-nums"
      style={{ backgroundColor: c.bg, color: c.text }}
      data-testid={`periods-row-${rowId}-progress`}
      data-progress-tone={tone}
    >
      {submitted}/{total}
    </span>
  );
}

/**
 * 3-dot kebab action menu. The menu items are filtered by the
 * `(periodState, canReopen, canArchive)` triple so the user only sees
 * the legal lifecycle moves for the row.
 *
 * Open + Scheduled have no admin actions in 51-B — the auto-publisher
 * + auto-creator handle those transitions. Documented as an open
 * question in the SUMMARY.
 */
function ActionMenu({
  row,
  onPublish,
  onReopen,
  onArchive,
  onUnarchive,
}: {
  readonly row: PeriodListItem;
} & Omit<PeriodTableProps, 'rows' | 'testIdPrefix'>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Click-outside dismissal. Mirrors the pattern used by the existing
  // admin dropdowns (e.g. stage-assignment-editor).
  useEffect(() => {
    if (!open) return undefined;
    function handler(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Build the menu item list before render so the "no available actions"
  // branch can disable the trigger button.
  const items: Array<{
    label: string;
    onClick: () => void;
    testId: string;
    tone?: 'danger';
  }> = [];

  if (row.periodState === 'open') {
    // Head can manually publish an open period without waiting for the
    // auto-publisher (matches the existing /head/report Publish button).
    items.push({
      label: 'Publish now',
      onClick: () => onPublish(row),
      testId: `action-publish-${row.id}`,
    });
  }
  if (row.periodState === 'published' && row.canReopen) {
    items.push({
      label: 'Reopen',
      onClick: () => onReopen(row),
      testId: `action-reopen-${row.id}`,
    });
  }
  if (row.canArchive) {
    items.push({
      label: 'Archive',
      onClick: () => onArchive(row),
      testId: `action-archive-${row.id}`,
      tone: 'danger',
    });
  }
  if (row.periodState === 'archived') {
    items.push({
      label: 'Unarchive',
      onClick: () => onUnarchive(row),
      testId: `action-unarchive-${row.id}`,
    });
  }

  const disabled = items.length === 0;

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for period ${row.id}`}
        data-testid={`action-menu-trigger-${row.id}`}
        className="btn-press inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[var(--color-muted-foreground)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <KebabIcon />
      </button>
      {open && (
        <div
          role="menu"
          data-testid={`action-menu-${row.id}`}
          className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white shadow-md"
        >
          {items.map((item) => (
            <button
              key={item.testId}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              data-testid={item.testId}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-hover)] ${
                item.tone === 'danger'
                  ? 'text-[#991b1b]'
                  : 'text-[var(--color-foreground)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chevron({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRange(start: Date | string, end: Date | string): string {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  const sameMonth = startDate.getUTCMonth() === endDate.getUTCMonth();
  const startStr = startDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: sameMonth ? undefined : 'short',
  });
  const endStr = endDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}
