'use client';

import { useState } from 'react';

import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import { PriorityEditDialog } from './priority-edit-dialog';
import type { PriorityEntry } from './mock-data';

type PrioritiesSectionProps = {
  readonly priorities: PriorityEntry[];
  readonly readOnly?: boolean;
  readonly onChange?: (priorities: PriorityEntry[]) => void;
};

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
 * Variable-length priority list. Add / Edit go through PriorityEditDialog
 * so the interaction shape matches Item, Risk, and Decision (open modal
 * → fill → save). Earlier this section used inline-editable inputs, which
 * was the cheapest UX given Priority has only one field — but the
 * inconsistency with the other CRUD surfaces was confusing the user.
 * Ranks renumber sequentially on add / delete so adjacent slots are
 * always 1..N (the schema allows up to 50 per `draftSaveSchema`).
 */
export function PrioritiesSection({ priorities, readOnly = false, onChange }: PrioritiesSectionProps) {
  const sorted = [...priorities].sort((a, b) => a.rank - b.rank);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);
  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: 'create' }
    | { open: true; mode: 'edit'; priority: PriorityEntry; idx: number }
  >({ open: false });

  function emit(next: PriorityEntry[]) {
    // Always renumber so ranks stay 1..N contiguous regardless of how the
    // caller mutates the array. The schema accepts any positive int but the
    // UI is simpler when ranks have no gaps.
    const renumbered = next.map((p, idx) => ({ ...p, rank: idx + 1 }));
    onChange?.(renumbered);
  }

  function handleAdd() {
    if (readOnly) return;
    setDialogState({ open: true, mode: 'create' });
  }

  function handleEdit(idx: number) {
    if (readOnly) return;
    const target = sorted[idx];
    if (!target) return;
    setDialogState({ open: true, mode: 'edit', priority: target, idx });
  }

  function handleDialogSave(saved: PriorityEntry) {
    if (!dialogState.open) return;
    if (dialogState.mode === 'create') {
      emit([...sorted, saved]);
    } else {
      emit(sorted.map((p, i) => (i === dialogState.idx ? saved : p)));
    }
    setDialogState({ open: false });
  }

  function handleDialogCancel() {
    setDialogState({ open: false });
  }

  function handleDelete(idx: number) {
    if (readOnly) return;
    setPendingDeleteIdx(idx);
  }

  function confirmDelete() {
    if (pendingDeleteIdx === null) return;
    emit(sorted.filter((_, i) => i !== pendingDeleteIdx));
    setPendingDeleteIdx(null);
  }

  const addButton = !readOnly && (
    <button
      type="button"
      className="btn-press flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
      onClick={handleAdd}
    >
      + Add Priority
    </button>
  );

  if (sorted.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[#f8f6f2] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {readOnly ? 'No priorities reported.' : 'No priorities yet. Use “+ Add Priority” to list what matters most.'}
        </div>
        {addButton}
        <PriorityEditDialog
          open={dialogState.open && dialogState.mode === 'create'}
          priority={null}
          nextRank={1}
          onSave={handleDialogSave}
          onCancel={handleDialogCancel}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((entry, idx) => {
        const tintKey = (entry.rank === 1 || entry.rank === 2 || entry.rank === 3) ? entry.rank : 'rest';
        return (
          <div
            key={`${entry.rank}-${idx}`}
            data-testid="priority-row"
            className="flex items-center gap-3 rounded-lg p-4"
            // PRI-1 (Phase 33-04): mockup distinguishes the row tint between
            // top-2 (gold-light `#faf6ee`) and rank 3+ (canvas `#f4f1eb`).
            // Earlier every row used the same gold-light wash, blurring rank.
            style={{ background: entry.rank <= 2 ? '#faf6ee' : '#f4f1eb' }}
          >
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-sans)] text-sm font-bold tabular-nums"
              style={{ background: RANK_TINT[tintKey], color: RANK_TEXT[tintKey] }}
            >
              {entry.rank}
            </span>
            <button
              type="button"
              className="flex-1 cursor-text rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-left text-sm transition-colors hover:border-[var(--color-starbucks-accent)] hover:bg-[#f8f6f2] disabled:cursor-default disabled:hover:border-[rgba(0,0,0,0.2)] disabled:hover:bg-white"
              onClick={() => handleEdit(idx)}
              disabled={readOnly}
              aria-label={`Edit priority ${entry.rank}`}
            >
              {entry.text.trim().length > 0 ? (
                <span className="break-words text-[var(--color-foreground)]">{entry.text}</span>
              ) : (
                <span className="text-[var(--color-muted-foreground)]">— pending</span>
              )}
            </button>
            {!readOnly && (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)]"
                  onClick={() => handleEdit(idx)}
                  aria-label={`Edit priority ${entry.rank}`}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
                  onClick={() => handleDelete(idx)}
                  aria-label={`Delete priority ${entry.rank}`}
                >
                  <DeleteIcon />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {addButton}

      <PriorityEditDialog
        open={dialogState.open}
        priority={dialogState.open && dialogState.mode === 'edit' ? dialogState.priority : null}
        nextRank={dialogState.open && dialogState.mode === 'create' ? sorted.length + 1 : (dialogState.open && dialogState.mode === 'edit' ? dialogState.priority.rank : 1)}
        onSave={handleDialogSave}
        onCancel={handleDialogCancel}
      />

      <ConfirmDeleteDialog
        open={pendingDeleteIdx !== null}
        title="Delete priority?"
        preview={pendingDeleteIdx !== null ? sorted[pendingDeleteIdx]?.text || '(empty)' : ''}
        subtitle={pendingDeleteIdx !== null ? `Priority ${pendingDeleteIdx + 1}` : undefined}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteIdx(null)}
      />
    </div>
  );
}
