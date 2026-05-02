'use client';

import type { PriorityEntry } from './mock-data';

type PrioritiesSectionProps = {
  readonly priorities: PriorityEntry[];
  readonly readOnly?: boolean;
  readonly onChange?: (priorities: PriorityEntry[]) => void;
};

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

const RANK_TINT: Record<1 | 2 | 3 | 'rest', string> = {
  1: '#cba258',
  2: '#dfc49d',
  3: 'var(--color-muted)',
  rest: 'var(--color-muted)',
};

const RANK_TEXT: Record<1 | 2 | 3 | 'rest', string> = {
  1: '#fff',
  2: '#8a6d1b',
  3: 'var(--color-muted-foreground)',
  rest: 'var(--color-muted-foreground)',
};

/**
 * Variable-length priority list. Earlier the section enforced exactly 3 fixed
 * slots, but the user wants to add as many priorities as needed (the schema
 * allows up to 50 per `draftSaveSchema`). Ranks renumber sequentially on add /
 * delete so adjacent slots are always 1..N.
 */
export function PrioritiesSection({ priorities, readOnly = false, onChange }: PrioritiesSectionProps) {
  const sorted = [...priorities].sort((a, b) => a.rank - b.rank);

  function emit(next: PriorityEntry[]) {
    // Always renumber so ranks stay 1..N contiguous regardless of how the
    // caller mutates the array. The schema accepts any positive int but the
    // UI is simpler when ranks have no gaps.
    const renumbered = next.map((p, idx) => ({ ...p, rank: idx + 1 }));
    onChange?.(renumbered);
  }

  function handleTextChange(idx: number, newText: string) {
    if (readOnly) return;
    const next = sorted.map((p, i) => (i === idx ? { ...p, text: newText } : p));
    emit(next);
  }

  function handleDelete(idx: number) {
    if (readOnly) return;
    emit(sorted.filter((_, i) => i !== idx));
  }

  function handleAdd() {
    if (readOnly) return;
    emit([...sorted, { rank: sorted.length + 1, text: '' }]);
  }

  return (
    <div className="space-y-3">
      {sorted.map((entry, idx) => {
        const tintKey = (entry.rank === 1 || entry.rank === 2 || entry.rank === 3) ? entry.rank : 'rest';
        return (
          <div
            key={`${entry.rank}-${idx}`}
            className="flex items-center gap-3 rounded-lg p-4"
            style={{ background: '#faf6ee' }}
          >
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-sans)] text-sm font-bold tabular-nums"
              style={{ background: RANK_TINT[tintKey], color: RANK_TEXT[tintKey] }}
            >
              {entry.rank}
            </span>
            <input
              type="text"
              className="flex-1 rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              value={entry.text}
              placeholder={`Priority ${entry.rank}...`}
              onChange={(e) => handleTextChange(idx, e.target.value)}
              readOnly={readOnly}
              aria-label={`Priority ${entry.rank}`}
            />
            {!readOnly && (
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-0 bg-transparent p-2.5 text-[rgba(0,0,0,0.25)] transition-colors hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
                onClick={() => handleDelete(idx)}
                aria-label={`Delete priority ${entry.rank}`}
              >
                <DeleteIcon />
              </button>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <button
          type="button"
          className="btn-press flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
          onClick={handleAdd}
        >
          + Add Priority
        </button>
      )}
    </div>
  );
}
