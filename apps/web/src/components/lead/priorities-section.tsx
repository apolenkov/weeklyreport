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

export function PrioritiesSection({ priorities, readOnly = false, onChange }: PrioritiesSectionProps) {
  function handleTextChange(rank: number, newText: string) {
    onChange?.(
      priorities.map((p) => (p.rank === rank ? { ...p, text: newText } : p)),
    );
  }

  return (
    <div className="space-y-3">
      {priorities.map((priority) => {
        const style = RANK_STYLES[priority.rank] ?? RANK_STYLES[3]!;
        return (
          <div
            key={priority.rank}
            className="flex items-center gap-3 rounded-lg p-4"
            style={{ background: style.bg }}
          >
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-sans)] text-sm font-bold tabular-nums"
              style={{ background: style.circleBg, color: style.circleText }}
            >
              {priority.rank}
            </span>
            <input
              type="text"
              className="flex-1 rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              value={priority.text}
              onChange={(e) => handleTextChange(priority.rank, e.target.value)}
              readOnly={readOnly}
            />
          </div>
        );
      })}
    </div>
  );
}
