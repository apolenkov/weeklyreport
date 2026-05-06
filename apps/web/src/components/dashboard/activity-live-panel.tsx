'use client';

import { useQuery } from '@tanstack/react-query';

import type { ActivityLiveResponse, ActivityLiveRow } from '@customreport/shared';

import { useTRPC } from '../../lib/trpc-context';

/**
 * UX-18 (Phase 35-08): "Активность за текущий период" panel.
 *
 * Renders one row per lead's section in the open report period with a
 * status pill (Черновик / Отправлено), counts (items / risks /
 * decisions / priorities), and a relative-time of last edit. Polls
 * activity.live every 15 seconds.
 *
 * Click on a row → /lead/report?period=<reportId>&authorId=<leadId>
 * (existing head-can-view-lead-form pattern).
 *
 * If the period is closed/published the panel renders a "Период
 * опубликован" empty state instead of a row grid.
 */
const POLL_INTERVAL_MS = 15_000;

export function ActivityLivePanel() {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.activity.live.queryOptions(),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  return (
    <section
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
      aria-labelledby="activity-live-heading"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="activity-live-heading"
          className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]"
        >
          Активность за текущий период
        </h2>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          Обновляется каждые 15 секунд
        </span>
      </header>
      {renderBody(query.data, query.isLoading, query.isError, query.error)}
    </section>
  );
}

function renderBody(
  data: ActivityLiveResponse | undefined,
  isLoading: boolean,
  isError: boolean,
  error: unknown,
) {
  if (isLoading && !data) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Загрузка активности…
      </p>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'Не удалось загрузить активность';
    return (
      <p className="text-sm text-[var(--color-danger)]">
        {message}
      </p>
    );
  }

  if (!data || !data.reportId) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Нет открытого периода для отчётности.
      </p>
    );
  }

  if (data.periodStatus !== 'open') {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Период опубликован — активность не отслеживается.
      </p>
    );
  }

  // We already returned early when reportId was null; capture into a
  // const so the closure below sees a non-nullable string without a `!`.
  const reportId = data.reportId;

  if (data.rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Тимлиды ещё не начали заполнять отчёт.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-border)]" aria-label="Лиды и статус секций">
      {data.rows.map((row) => (
        <ActivityRow key={row.leadId} row={row} reportId={reportId} />
      ))}
    </ul>
  );
}

function ActivityRow({
  row,
  reportId,
}: {
  readonly row: ActivityLiveRow;
  readonly reportId: string;
}) {
  // 35-07 (UX-15): switched to addressed URL `/lead/report/<reportId>`.
  // The legacy `?period=` query is still accepted by the bare route for
  // back-compat, but new links always use the addressed form so they're
  // shareable / bookmarkable.
  const href = `/lead/report/${encodeURIComponent(reportId)}?authorId=${encodeURIComponent(row.leadId)}`;
  const lastEdit = row.lastEditAt
    ? formatRelative(new Date(row.lastEditAt))
    : 'ещё не начал';

  return (
    <li>
      <a
        href={href}
        className="flex flex-wrap items-center gap-3 py-3 transition-colors hover:bg-[var(--color-success)]"
      >
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-success)] text-[12px] font-semibold text-[var(--color-starbucks-accent)]"
          aria-hidden="true"
        >
          {initials(row.leadName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--color-foreground)]">
              {row.leadName}
            </span>
            <StatusPill status={row.status} />
          </div>
          <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {row.itemCount} задач · {row.riskCount} рисков · {row.decisionCount} решений · {row.priorityCount} приоритетов
          </div>
        </div>
        <div className="text-right text-xs text-[var(--color-muted-foreground)]">
          {lastEdit}
        </div>
      </a>
    </li>
  );
}

function StatusPill({ status }: { readonly status: 'draft' | 'submitted' }) {
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-starbucks-accent)]">
        Отправлено
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold text-[#8a6d1b]">
      Черновик
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '??';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

// Lightweight relative-time formatter — no extra dep needed for "X минут
// назад" / "только что". For sub-minute we say "только что", for hours+
// we fall back to the locale time.
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 30) return 'только что';
  if (diffSec < 60) return `${diffSec} сек назад`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ч назад`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} дн назад`;
  return date.toLocaleDateString('ru-RU');
}
