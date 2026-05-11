'use client';

import { useEffect, useState } from 'react';
import type { DecisionEntry } from './mock-data';
import { StageMultiSelect } from './stage-multi-select';
import { joinStageNames } from './stage-tags';

type DecisionEditDialogProps = {
  readonly open: boolean;
  /** null = create mode, DecisionEntry = edit mode. */
  readonly decision: DecisionEntry | null;
  /**
   * Default owner for newly-created decisions. Should be the current user's
   * display name — leads usually own the decisions they raise. Setting this
   * up-front keeps the chrome out of their way.
   */
  readonly defaultOwner?: string;
  /**
   * 35-04 (FEAT-144): SDLC stages available to the lead across all
   * assigned projects. Decisions are department-scoped (no projectId), so
   * the union across projects is the right denominator for the dropdown.
   */
  readonly availableStages?: readonly string[];
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
};

export function DecisionEditDialog({
  open,
  decision,
  defaultOwner,
  availableStages,
  onSave,
  onCancel,
}: DecisionEditDialogProps) {
  const isCreate = decision === null;

  const [text, setText] = useState(decision?.text ?? '');
  const [owner, setOwner] = useState(decision?.owner ?? defaultOwner ?? '');
  const [impact, setImpact] = useState(decision?.impact ?? '');
  const [deadline, setDeadline] = useState(decision?.deadline ?? '');
  // UFB-073: pre-select all owned stages on create; restore existing on edit.
  const [stageName, setStageName] = useState<string>(
    decision?.stageName && decision.stageName !== '—'
      ? decision.stageName
      : (joinStageNames(availableStages ?? []) ?? ''),
  );
  // Per-field error map — same pattern as risk-edit-dialog. The single
  // bottom error string used to highlight only the first failure and
  // pinned the message under the wrong field, so each border now turns
  // destructive independently.
  const [errors, setErrors] = useState<{ text?: string; owner?: string; impact?: string }>({});

  useEffect(() => {
    if (open) {
      setText(decision?.text ?? '');
      setOwner(decision?.owner ?? defaultOwner ?? '');
      setImpact(decision?.impact ?? '');
      setDeadline(decision?.deadline ?? '');
      setStageName(
        decision?.stageName && decision.stageName !== '—'
          ? decision.stageName
          : (joinStageNames(availableStages ?? []) ?? ''),
      );
      setErrors({});
    }
  }, [
    open,
    decision?.id,
    decision?.text,
    decision?.owner,
    decision?.impact,
    decision?.deadline,
    decision?.stageName,
    defaultOwner,
    availableStages,
  ]);

  if (!open) return null;

  const headerVerb = isCreate ? 'Add Decision' : 'Edit Decision';

  function handleSave() {
    const t = text.trim();
    const o = owner.trim();
    const im = impact.trim();
    const next: typeof errors = {};
    if (t.length === 0) next.text = 'Decision text is required';
    if (o.length === 0) next.owner = 'Owner is required';
    if (im.length === 0) next.impact = 'Impact is required';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    onSave({
      id: decision?.id ?? crypto.randomUUID(),
      productId: decision?.productId ?? '',
      productName: decision?.productName ?? 'Group',
      text: t,
      owner: o,
      impact: im,
      deadline: deadline ? deadline : null,
      stageName: stageName.trim() || '—',
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
            <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
              The choice you need leadership to make — phrase it as a yes/no
              or short statement, not a discussion topic.
            </p>
            <textarea
              id="dec-text"
              autoFocus
              aria-invalid={errors.text ? 'true' : 'false'}
              aria-describedby={errors.text ? 'dec-text-error' : undefined}
              className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                errors.text
                  ? 'border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]'
                  : 'border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]'
              }`}
              style={{ minHeight: '60px' }}
              value={text}
              onChange={(e) => { setText(e.target.value); setErrors((prev) => ({ ...prev, text: undefined })); }}
              placeholder="e.g. Approve hiring of 2 SDETs in Q3"
            />
            {errors.text && (
              <p id="dec-text-error" className="mt-1 text-xs text-[var(--color-destructive)]">{errors.text}</p>
            )}
          </div>

          {/* Owner + Deadline row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]" htmlFor="dec-owner">
                Owner *
              </label>
              <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
                Who is accountable. Defaults to you. If the owner is someone else
                (e.g. Head, PM), you raise the decision but they make the call.
              </p>
              <input
                id="dec-owner"
                type="text"
                aria-invalid={errors.owner ? 'true' : 'false'}
                aria-describedby={errors.owner ? 'dec-owner-error' : undefined}
                readOnly
                aria-readonly="true"
                className={`w-full rounded-xl border bg-[var(--color-muted)] px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                  errors.owner
                    ? 'border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]'
                    : 'border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]'
                }`}
                value={owner}
                placeholder="e.g. yourself or Head"
              />
              {errors.owner && (
                <p id="dec-owner-error" className="mt-1 text-xs text-[var(--color-destructive)]">{errors.owner}</p>
              )}
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

          <StageMultiSelect
            id="dec-stage"
            value={stageName}
            stages={availableStages ?? []}
            onChange={(next) => setStageName(next ?? '')}
          />

          {/* Impact */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]" htmlFor="dec-impact">
              Impact *
            </label>
            <textarea
              id="dec-impact"
              aria-invalid={errors.impact ? 'true' : 'false'}
              aria-describedby={errors.impact ? 'dec-impact-error' : undefined}
              className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                errors.impact
                  ? 'border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]'
                  : 'border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]'
              }`}
              style={{ minHeight: '50px' }}
              value={impact}
              onChange={(e) => { setImpact(e.target.value); setErrors((prev) => ({ ...prev, impact: undefined })); }}
              placeholder="What changes when this is decided?"
            />
            {errors.impact && (
              <p id="dec-impact-error" className="mt-1 text-xs text-[var(--color-destructive)]">{errors.impact}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
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
