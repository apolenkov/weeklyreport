'use client';

import type { PriorityEntry } from './mock-data';

type PrioritiesSectionProps = {
  readonly priorities: PriorityEntry[];
  readonly readOnly?: boolean;
  readonly onChange?: (priorities: PriorityEntry[]) => void;
};

const RANK_STYLES: Record<number, { bg: string; circleBg: string; circleText: string }> = {
  1: { bg: '#faf6ee', circleBg: '#cba258', circleText: '#fff' },
  2: { bg: '#faf6ee', circleBg: '#dfc49d', circleText: '#8a6d1b' },
  3: { bg: 'var(--color-background)', circleBg: 'var(--color-muted)', circleText: 'var(--color-muted-foreground)' },
};

const RANKS = [1, 2, 3] as const;

const PLACEHOLDERS: Record<1 | 2 | 3, string> = {
  1: 'Top priority for next week...',
  2: 'Second priority...',
  3: 'Third priority...',
};

export function PrioritiesSection({ priorities, readOnly = false, onChange }: PrioritiesSectionProps) {
  // Build a quick lookup so each rank slot renders even when the underlying
  // array is sparse (server-side may have only rank=1 saved).
  const byRank = new Map<number, PriorityEntry>(priorities.map((p) => [p.rank, p]));

  function handleTextChange(rank: 1 | 2 | 3, newText: string) {
    if (readOnly) return;
    // Upsert by rank: keep every other rank, replace/insert this one. Sort by
    // rank so the parent merger sees a stable ordering.
    const others = priorities.filter((p) => p.rank !== rank);
    const next: PriorityEntry[] = [...others, { rank, text: newText }].sort(
      (a, b) => a.rank - b.rank,
    );
    onChange?.(next);
  }

  return (
    <div className="space-y-3">
      {RANKS.map((rank) => {
        const style = RANK_STYLES[rank] ?? RANK_STYLES[3]!;
        const entry = byRank.get(rank);
        const text = entry?.text ?? '';
        return (
          <div
            key={rank}
            className="flex items-center gap-3 rounded-lg p-4"
            style={{ background: style.bg }}
          >
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-sans)] text-sm font-bold tabular-nums"
              style={{ background: style.circleBg, color: style.circleText }}
            >
              {rank}
            </span>
            <input
              type="text"
              className="flex-1 rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              value={text}
              placeholder={PLACEHOLDERS[rank]}
              onChange={(e) => handleTextChange(rank, e.target.value)}
              readOnly={readOnly}
              aria-label={`Priority ${rank}`}
            />
          </div>
        );
      })}
    </div>
  );
}
