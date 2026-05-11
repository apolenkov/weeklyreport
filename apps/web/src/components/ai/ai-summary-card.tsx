'use client';

// Phase 31 (AI-01) — Executive summary card. Renders above the assembled
// report; never overwrites the head's own narrative. Dismissible per
// session via local useState (no DB persistence). Regenerate button is
// gated by the head role — non-heads only see the summary itself.
import { useContext, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../lib/trpc-context';
import { SessionContext } from '../../lib/session-provider';

type Props = {
  readonly reportId: string;
};

export function AiSummaryCard({ reportId }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  // Read session via the raw context so the card degrades gracefully in
  // test harnesses that don't wrap the tree in <SessionProvider>. The
  // production app shell always wraps; missing context here means a
  // narrow unit-test render and we simply hide the head-only Regenerate.
  const sessionState = useContext(SessionContext);
  const isHead = sessionState?.user?.role === 'head';
  const [dismissed, setDismissed] = useState(false);

  const summaryQ = useQuery(trpc.ai.summary.queryOptions({ reportId }));
  const regenMut = useMutation(
    trpc.ai.regenerateSummary.mutationOptions({
      onSuccess: () => {
        // Re-run the query so the freshly regenerated summary renders.
        void qc.invalidateQueries({
          queryKey: trpc.ai.summary.queryKey({ reportId }),
        });
      },
    }),
  );

  if (dismissed) return null;
  if (summaryQ.isLoading) {
    return (
      <div
        className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/70 p-4 text-sm text-[var(--color-muted-foreground)]"
        aria-busy="true"
      >
        Loading executive summary…
      </div>
    );
  }

  const data = summaryQ.data;
  if (!data) return null;

  if (!data.available) {
    // UFB-066: previously this rendered one muted line «AI summary
    // unavailable.» with no AI affordance — felt unrelated to AI and read
    // as a generic empty state. New placeholder reads as a paused AI
    // generation: sparkle icon + 3 shimmer bars approximating the summary
    // shape + one explicit reason line. Once a real provider is wired
    // (Phase 54 activation, AI_PROVIDER env), this branch is rarely hit.
    return (
      <div
        className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/85 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        aria-label="AI summary pending"
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
            aria-hidden="true"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2z" />
              <circle cx="19" cy="4" r="1" />
              <circle cx="5" cy="19" r="1" />
            </svg>
            AI · pending
          </span>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            нет данных для генерации
          </span>
        </div>
        {/* 3-bar shimmer placeholder approximating the real summary shape:
            one wide narrative line + two short highlight tags. */}
        <div className="mt-3 space-y-2">
          <div className="h-3 w-11/12 rounded bg-[var(--color-muted)]/40" />
          <div className="h-3 w-9/12 rounded bg-[var(--color-muted)]/30" />
          <div className="mt-2 flex gap-2">
            <div className="h-4 w-20 rounded bg-[var(--color-muted)]/30" />
            <div className="h-4 w-16 rounded bg-[var(--color-muted)]/30" />
            <div className="h-4 w-24 rounded bg-[var(--color-muted)]/30" />
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          AI summary появится после того, как в периоде будут заполненные
          секции. {/* TODO(Phase-54-activation): when real provider lands,
          this branch should rarely surface — fold into a more specific
          «embedding ingestion pending» message once AiIngestionJob worker
          is live. */}
        </p>
      </div>
    );
  }

  const { result } = data;
  const toneClass =
    result.tone === 'positive'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : result.tone === 'negative'
        ? 'text-red-700 bg-red-50 border-red-200'
        : 'text-amber-700 bg-amber-50 border-amber-200';

  return (
    <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/85 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass}`}
            aria-label={`Tone: ${result.tone}`}
          >
            AI · {result.tone}
          </span>
          {data.cached ? (
            <span className="text-xs text-[var(--color-muted-foreground)]">cached</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isHead ? (
            <button
              type="button"
              className="rounded-md border border-[rgba(0,0,0,0.15)] bg-transparent px-2 py-1 text-xs font-semibold hover:bg-[var(--color-surface-hover)]"
              onClick={() => regenMut.mutate({ reportId })}
              disabled={regenMut.isPending}
              aria-label="Regenerate summary"
            >
              {regenMut.isPending ? 'Regenerating…' : 'Regenerate'}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-[rgba(0,0,0,0.15)] bg-transparent px-2 py-1 text-xs font-semibold hover:bg-[var(--color-surface-hover)]"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss summary"
          >
            ×
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-foreground)]">
        {result.narrative}
      </p>
      {result.highlights.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {result.highlights.map((h) => (
            <li
              key={h}
              className="rounded-md bg-[var(--color-muted)] px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]"
            >
              {h}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
