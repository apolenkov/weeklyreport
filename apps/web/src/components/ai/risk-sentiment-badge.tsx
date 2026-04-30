'use client';

// Phase 31 (AI-02) — per-Risk sentiment badge. Hidden when AI is
// unavailable (does NOT block the row). Sized 24×24 max to avoid layout
// shift on mobile.
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../../lib/trpc-context';

type Props = {
  readonly riskId: string;
};

const LEVEL_STYLES: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

export function RiskSentimentBadge({ riskId }: Props) {
  const trpc = useTRPC();
  const q = useQuery(trpc.ai.sentiment.queryOptions({ riskId }));

  if (q.isLoading) {
    return (
      <span
        aria-busy="true"
        className="ml-1 inline-block h-4 w-4 animate-pulse rounded-full bg-[rgba(0,0,0,0.08)]"
      />
    );
  }
  const data = q.data;
  if (!data || !data.available) return null;
  const cls = LEVEL_STYLES[data.result.level];
  return (
    <span
      className={`ml-1 inline-flex items-center rounded-[var(--radius-pill)] border px-1.5 py-0 text-[10px] font-semibold ${cls}`}
      title={data.result.rationale}
      aria-label={`AI sentiment: ${data.result.level}`}
    >
      AI · {data.result.level}
    </span>
  );
}
