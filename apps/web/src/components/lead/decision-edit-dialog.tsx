'use client';

import { useEffect, useState } from 'react';
import type { DecisionEntry } from './mock-data';

type DecisionEditDialogProps = {
  readonly open: boolean;
  /** null = create mode, DecisionEntry = edit mode. */
  readonly decision: DecisionEntry | null;
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
};

export function DecisionEditDialog({
  open,
  decision,
  onSave,
  onCancel,
}: DecisionEditDialogProps) {
  const isCreate = decision === null;

  const [text, setText] = useState(decision?.text ?? '');
  const [owner, setOwner] = useState(decision?.owner ?? '');
  const [impact, setImpact] = useState(decision?.impact ?? '');
  const [deadline, setDeadline] = useState(decision?.deadline ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText(decision?.text ?? '');
      setOwner(decision?.owner ?? '');
      setImpact(decision?.impact ?? '');
      setDeadline(decision?.deadline ?? '');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, decision?.id]);

  if (!open) return null;

  const headerVerb = isCreate ? 'Add Decision' : 'Edit Decision';

  function handleSave() {
    const t = text.trim();
    const o = owner.trim();
    const im = impact.trim();
    if (t.length === 0) { setError('Decision text is required'); return; }
    if (o.length === 0) { setError('Owner is required'); return; }
    if (im.length === 0) { setError('Impact is required'); return; }
    onSave({
      id: decision?.id ?? crypto.randomUUID(),
      productId: decision?.productId ?? '',
      productName: decision?.productName ?? 'Department',
      text: t,
      owner: o,
      impact: im,
      deadline: deadline ? deadline : null,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
  }

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
          {headerVerb}
        </h2>

        <div className="space-y-4">
          {/* Decision text */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]" htmlFor="dec-text">
              Decision *
            </label>
            <textarea
              id="dec-text"
              autoFocus
              className="w-full resize-y rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              style={{ minHeight: '60px' }}
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null); }}
              placeholder="What needs to be decided?"
            />
          </div>

          {/* Owner + Deadline row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]" htmlFor="dec-owner">
                Owner *
              </label>
              <input
                id="dec-owner"
                type="text"
                className="w-full rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
                value={owner}
                onChange={(e) => { setOwner(e.target.value); setError(null); }}
                placeholder="Who is accountable?"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]" htmlFor="dec-deadline">
                Deadline
              </label>
              <input
                id="dec-deadline"
                type="date"
                className="w-full rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          {/* Impact */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]" htmlFor="dec-impact">
              Impact *
            </label>
            <textarea
              id="dec-impact"
              className="w-full resize-y rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              style={{ minHeight: '50px' }}
              value={impact}
              onChange={(e) => { setImpact(e.target.value); setError(null); }}
              placeholder="What changes when this is decided?"
            />
          </div>

          {error && (
            <p className="text-xs text-[var(--color-destructive)]">{error}</p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)]"
          >
            Save Decision
          </button>
        </div>
      </div>
    </div>
  );
}
