'use client';

import { useEffect, useRef, useState } from 'react';

import type { PriorityEntry } from './mock-data';

type PriorityEditDialogProps = {
  readonly open: boolean;
  /** Editing an existing row (`null` = create mode). */
  readonly priority: PriorityEntry | null;
  /** Used in the dialog header so the user knows which slot they're filling. */
  readonly nextRank: number;
  /**
   * 35-04 (FEAT-144): SDLC stages available to the lead across all
   * assigned projects. Priorities are department-scoped — same denominator
   * as decisions.
   */
  readonly availableStages?: readonly string[];
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
  availableStages,
  onSave,
  onCancel,
}: PriorityEditDialogProps) {
  const isCreate = priority === null;
  const [text, setText] = useState(priority?.text ?? '');
  const initialStage = priority?.stageName && priority.stageName !== '—' ? priority.stageName : '';
  const [stageName, setStageName] = useState<string>(initialStage);
  const [errors, setErrors] = useState<{ text?: string; stage?: string }>({});
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setText(priority?.text ?? '');
    setStageName(priority?.stageName && priority.stageName !== '—' ? priority.stageName : '');
    setErrors({});
    // Focus the input on open. requestAnimationFrame so the portal mount
    // has settled before we steal focus from the underlying overlay.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, priority?.rank, priority?.text, priority?.stageName]);

  if (!open) return null;

  function handleSave() {
    const trimmed = text.trim();
    const next: typeof errors = {};
    if (trimmed.length === 0) next.text = 'Priority text is required';
    if (stageName.trim().length === 0) next.stage = 'SDLC stage is required';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    onSave({
      rank: priority?.rank ?? nextRank,
      text: trimmed,
      stageName,
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
            aria-invalid={errors.text ? 'true' : 'false'}
            aria-describedby={errors.text ? 'priority-text-error' : undefined}
            className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
              errors.text
                ? 'border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]'
                : 'border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]'
            }`}
            style={{ minHeight: '70px' }}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setErrors((prev) => ({ ...prev, text: undefined }));
            }}
            placeholder="What matters most to ship this week?"
          />
          {errors.text && (
            <p id="priority-text-error" className="mt-1 text-xs text-[var(--color-destructive)]">
              {errors.text}
            </p>
          )}
        </div>

        {/* SDLC stage — 35-04 (FEAT-144). */}
        <div className="mt-4">
          <label
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
            htmlFor="priority-stage"
          >
            Стадия SDLC *
          </label>
          <select
            id="priority-stage"
            aria-invalid={errors.stage ? 'true' : 'false'}
            aria-describedby={errors.stage ? 'priority-stage-error' : undefined}
            className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:outline-none ${
              errors.stage
                ? 'border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]'
                : 'border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]'
            }`}
            value={stageName}
            onChange={(e) => { setStageName(e.target.value); setErrors((prev) => ({ ...prev, stage: undefined })); }}
          >
            <option value="">— Выберите стадию —</option>
            {(availableStages ?? []).map((stg) => (
              <option key={stg} value={stg}>{stg}</option>
            ))}
          </select>
          {errors.stage && (
            <p id="priority-stage-error" className="mt-1 text-xs text-[var(--color-destructive)]">
              {errors.stage}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)]"
            onClick={handleSave}
          >
            Save Priority
          </button>
        </div>
      </div>
    </div>
  );
}
