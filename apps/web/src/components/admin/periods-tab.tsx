'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

  // UFB-063: «New period» dialog state. Opens via header button; submits
  // to admin.createPeriodManual; on success invalidates the period
  // lists so the table reflects the new row without a full reload.
  const [showCreate, setShowCreate] = useState(false);

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

  // UFB-063: «New period» mutation. Pipes the server error message
  // through verbatim so overlap conflicts (server emits the colliding
  // date range) surface in the toast unchanged.
  const createMut = useMutation(
    trpc.admin.createPeriodManual.mutationOptions({
      onSuccess: () => {
        invalidatePeriodLists();
        toast.success('Period created');
        setShowCreate(false);
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to create period');
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
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            aria-label="New period"
            data-testid="periods-new-button"
          >
            <PlusIcon />
            New period
          </button>
        }
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

      {/* UFB-063: «New period» creation dialog ----------------------- */}
      {showCreate && (
        <CreatePeriodDialog
          onCancel={() => setShowCreate(false)}
          onSubmit={(values) => createMut.mutate(values)}
          isPending={createMut.isPending}
        />
      )}
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  // UFB-063: the kebab dropdown is rendered via a portal to <body> so
  // the outer `overflow-x-auto` on the table wrapper does not clip it
  // (per CSS spec, `overflow-x: auto` with default `overflow-y: visible`
  // computes to `overflow-y: auto`, which clips an absolutely-positioned
  // child vertically — Phase 51-B kebab was invisible on UAT). The
  // portal places the menu at the document level; coords are derived
  // from the trigger's getBoundingClientRect() and recomputed on scroll
  // / resize so the menu stays anchored to the row's button.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return undefined;
    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      // Anchor the menu's right edge to the trigger's right edge
      // (matches the previous `right-0` absolute positioning).
      const MENU_MIN_WIDTH = 160; // px — matches min-w-[10rem]
      setMenuCoords({
        top: rect.bottom + 4 + window.scrollY,
        left: Math.max(8, rect.right - MENU_MIN_WIDTH) + window.scrollX,
      });
    }
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  // Click-outside dismissal. With the portal, the menu is no longer a
  // DOM descendant of `wrapperRef`, so we have to check both the
  // trigger wrapper AND the menu node before closing.
  useEffect(() => {
    if (!open) return undefined;
    function handler(e: MouseEvent) {
      const inTrigger = wrapperRef.current?.contains(e.target as Node);
      const inMenu = menuRef.current?.contains(e.target as Node);
      if (!inTrigger && !inMenu) {
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

  // SSR guard: createPortal is a no-op during server rendering. The
  // menu only ever renders when `open` is true, and `open` flips on
  // user click — so we're always client-side at render time. We still
  // gate on `typeof document` to keep tests that run without a DOM
  // (none today, but future contracts) safe.
  const menu = open && typeof document !== 'undefined' ? (
    <div
      ref={menuRef}
      role="menu"
      data-testid={`action-menu-${row.id}`}
      style={{
        position: 'absolute',
        top: menuCoords.top,
        left: menuCoords.left,
        zIndex: 1000,
      }}
      className="min-w-[10rem] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white shadow-md"
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
  ) : null;

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        ref={triggerRef}
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
      {menu && createPortal(menu, document.body)}
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

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ---------------------------------------------------------------------
// UFB-063: CreatePeriodDialog — admin «New period» modal.
// ---------------------------------------------------------------------

/**
 * Compute the next Monday after `from` (inclusive: if `from` is already
 * Monday, return `from` at 00:00 UTC). Used as the sensible default
 * pre-fill so the typical admin click → submit flow lands on a clean
 * week boundary that matches the cron's "next Monday" anchoring.
 */
function nextMonday(from: Date): string {
  const d = new Date(from.getTime());
  // getUTCDay: 0=Sun, 1=Mon..6=Sat. For Sun add 1 day; for any other
  // weekday add (8 - day) % 7 days. For Monday this evaluates to 0 →
  // returns `from` unchanged.
  const day = d.getUTCDay();
  const offset = day === 0 ? 1 : (8 - day) % 7;
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(0, 0, 0, 0);
  // Render as `YYYY-MM-DD` for the <input type="date"> value.
  return d.toISOString().slice(0, 10);
}

type CreatePeriodValues = {
  periodStart: Date;
  periodEnd?: Date;
  deadline?: Date;
  weekLabel?: string;
};

function CreatePeriodDialog({
  onCancel,
  onSubmit,
  isPending,
}: {
  readonly onCancel: () => void;
  readonly onSubmit: (values: CreatePeriodValues) => void;
  readonly isPending: boolean;
}) {
  const [periodStart, setPeriodStart] = useState(() => nextMonday(new Date()));
  const [periodEnd, setPeriodEnd] = useState('');
  // <input type="datetime-local"> emits "YYYY-MM-DDTHH:MM" in local TZ;
  // we convert to UTC ISO on submit.
  const [deadline, setDeadline] = useState('');
  const [weekLabel, setWeekLabel] = useState('');

  // Esc-to-close + click-outside (matches the groups-tab dialog pattern).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  function handleSubmit() {
    if (!periodStart) return;
    // <input type="date"> emits "YYYY-MM-DD". Treat as UTC midnight so
    // the server's overlap math and the period-row date pickers stay
    // in the same frame (server expects UTC dates).
    const startDate = new Date(`${periodStart}T00:00:00.000Z`);
    const endDate = periodEnd
      ? new Date(`${periodEnd}T23:59:59.999Z`)
      : undefined;
    const deadlineDate = deadline
      ? // datetime-local has no zone; the browser already interprets it
        // as local. Convert to UTC by passing through Date.
        new Date(deadline)
      : undefined;
    onSubmit({
      periodStart: startDate,
      periodEnd: endDate,
      deadline: deadlineDate,
      weekLabel: weekLabel.trim() === '' ? undefined : weekLabel.trim(),
    });
  }

  const canSubmit = periodStart !== '' && !isPending;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
      data-testid="periods-create-dialog"
    >
      <div
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="New period"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          New period
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Mints a reporting period without waiting for the daily auto-creator.
          End date and deadline default from AppSettings when left blank.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="period-start"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Period start <span className="text-[#991b1b]">*</span>
            </label>
            <input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
              data-testid="periods-create-start"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="period-end"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Period end{' '}
              <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
                (optional)
              </span>
            </label>
            <input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              data-testid="periods-create-end"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="period-deadline"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Deadline{' '}
              <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
                (optional)
              </span>
            </label>
            <input
              id="period-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              data-testid="periods-create-deadline"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="period-label"
              className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
            >
              Week label{' '}
              <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
                (optional)
              </span>
            </label>
            <input
              id="period-label"
              type="text"
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
              maxLength={64}
              placeholder="e.g. Sprint 12 catch-up"
              data-testid="periods-create-label"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            data-testid="periods-create-cancel"
            className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="periods-create-submit"
            className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
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
