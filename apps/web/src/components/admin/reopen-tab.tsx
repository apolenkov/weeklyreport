'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../lib/trpc-context';

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'all';

const FILTERS: ReadonlyArray<{ value: FilterStatus; label: string }> = [
  { value: 'pending', label: 'В ожидании' },
  { value: 'approved', label: 'Одобрено' },
  { value: 'rejected', label: 'Отклонено' },
  { value: 'all', label: 'Все' },
];

const STATUS_LABEL: Record<'pending' | 'approved' | 'rejected', string> = {
  pending: 'В ожидании',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};

const STATUS_PALETTE: Record<'pending' | 'approved' | 'rejected', string> = {
  pending: 'bg-amber-100 text-amber-900',
  approved: 'bg-[var(--color-success)] text-[var(--color-starbucks-accent)]',
  rejected: 'bg-red-100 text-red-900',
};

function formatPeriod(periodStart: string, periodEnd: string, label: string | null): string {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const fmt = (d: Date) =>
    `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`;
  return label ? `${label} · ${fmt(start)}–${fmt(end)}` : `${fmt(start)}–${fmt(end)}`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Reopen Requests tab — Head-side queue of lead-initiated reopen asks.
 *
 * Each request shows: who asked, which week+section, when, and the optional
 * reason. Head can Approve (section flips back to draft, lead can edit) or
 * Reject (section stays submitted; head writes a short note explaining why).
 *
 * Pending count is exposed via `admin.pendingReopenCount` so the tab badge
 * stays in sync without polling.
 */
export function ReopenTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const listQuery = useQuery(
    trpc.admin.listReopenRequests.queryOptions({ status: filter }),
  );

  const respondMut = useMutation(
    trpc.admin.respondReopenRequest.mutationOptions({
      onSuccess: ({ decision }) => {
        toast.success(
          decision === 'approved'
            ? 'Запрос одобрен — секция переоткрыта.'
            : 'Запрос отклонён.',
        );
        setRespondingId(null);
        setNote('');
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.listReopenRequests.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.pendingReopenCount.queryKey(),
        });
      },
      onError: (err) => {
        toast.error(`Не удалось обработать: ${err.message}`);
      },
    }),
  );

  const requests = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
            Запросы на переоткрытие
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            Лиды просят разрешить редактирование уже сданной секции.
          </p>
        </div>
        <div className="flex gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                filter === f.value
                  ? 'bg-[var(--color-starbucks-accent)] text-white'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[#f8f6f2]'
              }`}
              aria-pressed={filter === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {listQuery.isPending && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-sm text-[var(--color-muted-foreground)]">
          Загрузка…
        </div>
      )}

      {listQuery.isError && (
        <div className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-red-50 p-4 text-sm text-red-800">
          Не удалось загрузить запросы: {String(listQuery.error?.message ?? 'unknown')}
        </div>
      )}

      {!listQuery.isPending && !listQuery.isError && requests.length === 0 && (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[#fafaf7] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
          {filter === 'pending'
            ? 'Нет ожидающих запросов на переоткрытие.'
            : 'Здесь пока пусто.'}
        </div>
      )}

      <ul className="space-y-3">
        {requests.map((r) => {
          const isResponding = respondingId === r.id;
          const palette = STATUS_PALETTE[r.status as keyof typeof STATUS_PALETTE];
          const statusLabel = STATUS_LABEL[r.status as keyof typeof STATUS_LABEL];

          return (
            <li
              key={r.id}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]">
                      {r.requestedBy.name}
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {r.requestedBy.email}
                    </span>
                    <span
                      className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${palette}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {formatPeriod(r.report.periodStart, r.report.periodEnd, r.report.weekLabel)}
                    {' · отправлено '}
                    {formatTimestamp(r.createdAt)}
                  </div>
                </div>
                {r.status === 'pending' && !isResponding && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRespondingId(r.id);
                        setNote('');
                      }}
                      className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[#f8f6f2]"
                    >
                      Ответить
                    </button>
                  </div>
                )}
              </div>

              {r.reason && (
                <div className="mt-3 rounded-[var(--radius)] bg-[#f8f6f2] p-3 text-sm text-[var(--color-foreground)]">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                    Причина
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{r.reason}</div>
                </div>
              )}

              {r.status !== 'pending' && r.reviewNote && (
                <div className="mt-3 rounded-[var(--radius)] border border-[var(--color-border)] p-3 text-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                    Комментарий главы
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{r.reviewNote}</div>
                  {r.reviewedBy && r.reviewedAt && (
                    <div className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
                      {r.reviewedBy.name} · {formatTimestamp(r.reviewedAt)}
                    </div>
                  )}
                </div>
              )}

              {isResponding && (
                <div className="mt-3 space-y-2 rounded-[var(--radius)] border border-[var(--color-starbucks-accent)] bg-[rgba(0,117,74,0.04)] p-3">
                  <label
                    htmlFor={`note-${r.id}`}
                    className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]"
                  >
                    Комментарий (опционально, до 500 символов)
                  </label>
                  <textarea
                    id={`note-${r.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    placeholder="например: одобряю, перешли срок до пятницы 15:00"
                    className="w-full resize-y rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-starbucks-accent)] focus:outline-none"
                    style={{ minHeight: '60px' }}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRespondingId(null);
                        setNote('');
                      }}
                      disabled={respondMut.isPending}
                      className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[#f8f6f2] disabled:opacity-50"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        respondMut.mutate({
                          id: r.id,
                          decision: 'rejected',
                          note: note.trim() || undefined,
                        })
                      }
                      disabled={respondMut.isPending}
                      className="btn-press inline-flex items-center rounded-[var(--radius-pill)] bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Отклонить
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        respondMut.mutate({
                          id: r.id,
                          decision: 'approved',
                          note: note.trim() || undefined,
                        })
                      }
                      disabled={respondMut.isPending}
                      className="btn-press inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary)] disabled:opacity-50"
                    >
                      {respondMut.isPending ? 'Сохраняю…' : 'Одобрить'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
