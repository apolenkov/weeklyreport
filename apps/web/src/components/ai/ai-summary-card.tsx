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

// UFB-066: «AI Insights» section icon — four-pointed sparkle (the
// generative-AI shorthand used by Anthropic, Google, Notion, Figma).
// Same 24px box + primary stroke as Portfolio's GridIcon for visual
// consistency across report sections.
function AiSparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-shrink-0"
      style={{ color: "var(--color-primary)" }}
      stroke="currentColor"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* large sparkle */}
      <path d="M12 3 L13.5 9.5 L20 11 L13.5 12.5 L12 19 L10.5 12.5 L4 11 L10.5 9.5 Z" />
      {/* small companion sparkle top-right */}
      <path d="M19 4 L19.5 5.6 L21 6 L19.5 6.4 L19 8 L18.5 6.4 L17 6 L18.5 5.6 Z" />
    </svg>
  );
}

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
    // UFB-066 (2026-05-11): match the Portfolio Overview card style — same
    // radius, border, gradient bg, layered shadow, primary-color icon
    // header. Reads as a real AI section (sparkle icon + «AI Insights»
    // header), not as a generic empty muted line. All copy English per
    // CLAUDE.md «UI strings — English only до i18n» rule.
    return (
      <div className="mt-4 overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex w-full items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <AiSparkleIcon />
            <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
              AI Insights
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-amber-700"
              aria-label="AI summary pending"
            >
              pending
            </span>
          </div>
        </div>
        <div className="px-4 pb-4">
          {/* Shimmer placeholder matching the real summary shape:
              1 wide narrative line, 1 medium, then 3 highlight chips. */}
          <div className="space-y-2">
            <div className="h-3 w-11/12 rounded bg-[rgba(0,0,0,0.06)]" />
            <div className="h-3 w-8/12 rounded bg-[rgba(0,0,0,0.05)]" />
          </div>
          <div className="mt-3 flex gap-2">
            <div className="h-5 w-20 rounded-md bg-[rgba(0,0,0,0.05)]" />
            <div className="h-5 w-16 rounded-md bg-[rgba(0,0,0,0.05)]" />
            <div className="h-5 w-24 rounded-md bg-[rgba(0,0,0,0.05)]" />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
            Summary will be generated once sections are submitted for this period.
            {/* TODO(Phase-54-activation): when real provider lands, fold this
                into a more specific «ingestion pending» state once the
                AiIngestionJob worker is live. */}
          </p>
        </div>
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
