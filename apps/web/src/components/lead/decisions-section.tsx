'use client';

import type { DecisionEntry } from './mock-data';

type DecisionsSectionProps = {
  readonly decisions: DecisionEntry[];
  readonly readOnly?: boolean;
  readonly onChange?: (decisions: DecisionEntry[]) => void;
};

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

export function DecisionsSection({ decisions, readOnly = false, onChange }: DecisionsSectionProps) {
  function handleDelete(id: string) {
    onChange?.(decisions.filter((d) => d.id !== id));
  }

  function handleTextChange(id: string, newText: string) {
    onChange?.(
      decisions.map((d) => (d.id === id ? { ...d, text: newText } : d)),
    );
  }

  return (
    <div className="space-y-3">
      {decisions.map((decision) => (
        <div
          key={decision.id}
          className="rounded-lg p-4"
          style={{ background: 'var(--color-background)' }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-starbucks-accent)]">
              {decision.productName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-1 rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              value={decision.text}
              onChange={(e) => handleTextChange(decision.id, e.target.value)}
              readOnly={readOnly}
            />
            {!readOnly && (
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-0 bg-transparent p-2.5 text-[rgba(0,0,0,0.25)] transition-colors hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
                onClick={() => handleDelete(decision.id)}
                aria-label={`Delete decision for ${decision.productName}`}
              >
                <DeleteIcon />
              </button>
            )}
          </div>
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          className="btn-press flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
        >
          + Add Decision
        </button>
      )}
    </div>
  );
}
