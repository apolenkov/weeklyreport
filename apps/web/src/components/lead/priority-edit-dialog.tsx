'use client';

import { useEffect, useRef, useState } from 'react';

import type { PriorityEntry } from './mock-data';

type PriorityEditDialogProps = {
  readonly open: boolean;
  /** Editing an existing row (`null` = create mode). */
  readonly priority: PriorityEntry | null;
  /** Used in the dialog header so the user knows which slot they're filling. */
  readonly nextRank: number;
  readonly onSave: (next: PriorityEntry) => void;
  readonly onCancel: () => void;
};

/**
 * Single-field modal for adding/editing a priority. Brought online so
 * Item / Risk / Decision / Priority all share the same "open dialog →
 * fill → save" interaction shape — the previous inline-input row
 * felt like an outlier next to the other three. Validation is the
 * same as Risk's: trim() === '' rejects.
 */
export function PriorityEditDialog({
  open,
  priority,
  nextRank,
  onSave,
  onCancel,
}: PriorityEditDialogProps) {
  const isCreate = priority === null;
  const [text, setText] = useState(priority?.text ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setText(priority?.text ?? '');
    setError(null);
    // Focus the input on open. requestAnimationFrame so the portal mount
    // has settled before we steal focus from the underlying overlay.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, priority?.rank]);

  if (!open) return null;

  function handleSave() {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setError('Priority text is required');
      return;
    }
    onSave({
      rank: priority?.rank ?? nextRank,
      text: trimmed,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  const headerVerb = isCreate ? 'Add Priority' : 'Edit Priority';
  const slotLabel = isCreate ? `Priority ${nextRank}` : `Priority ${priority.rank}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-[var(--radius)] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${headerVerb} dialog`}
      >
        <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {headerVerb}{' '}
          <span className="text-[var(--color-muted-foreground)]">— {slotLabel}</span>
        </h2>

        <div>
          <label
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
            htmlFor="priority-text"
          >
            Description *
          </label>
          <textarea
            id="priority-text"
            ref={inputRef}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'priority-text-error' : undefined}
            className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
              error
                ? 'border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]'
                : 'border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]'
            }`}
            style={{ minHeight: '70px' }}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            placeholder="What matters most to ship this week?"
          />
          {error && (
            <p id="priority-text-error" className="mt-1 text-xs text-[var(--color-destructive)]">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-press inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-muted)] bg-transparent px-4 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-press inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
