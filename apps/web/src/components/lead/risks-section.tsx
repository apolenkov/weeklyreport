'use client';

import { useState } from 'react';

import type { RiskEntry } from './mock-data';

type RisksSectionProps = {
  readonly risks: RiskEntry[];
  readonly readOnly?: boolean;
};

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

export function RisksSection({ risks: initialRisks, readOnly = false }: RisksSectionProps) {
  const [risks, setRisks] = useState(initialRisks);

  function handleDelete(id: string) {
    setRisks((prev) => prev.filter((r) => r.id !== id));
  }

  function handleTextChange(id: string, newText: string) {
    setRisks((prev) =>
      prev.map((r) => (r.id === id ? { ...r, text: newText } : r)),
    );
  }

  return (
    <div className="space-y-4">
      {risks.map((risk) => {
        const isBlocked = risk.severity === 'blocked';
        return (
          <div
            key={risk.id}
            className="rounded-xl p-4"
            style={{
              background: isBlocked ? '#fdf8f8' : '#fffcf5',
              border: `1px solid ${isBlocked ? 'rgba(200,32,20,0.15)' : 'rgba(212,160,23,0.15)'}`,
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
                style={{
                  background: isBlocked ? '#fee2e2' : '#fef3c7',
                  color: isBlocked ? 'var(--color-destructive)' : '#8a6d1b',
                }}
              >
                {isBlocked ? 'Blocked' : 'At Risk'}
              </span>
              <span className="font-[family-name:var(--font-sans)] text-sm font-semibold">
                {risk.productName}
              </span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                &middot; {risk.stageName} stage
              </span>
              {!readOnly && (
                <button
                  type="button"
                  className="ml-auto flex min-h-[32px] min-w-[32px] items-center justify-center rounded-full border-0 bg-transparent p-1.5 text-[rgba(0,0,0,0.25)] transition-colors hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
                  onClick={() => handleDelete(risk.id)}
                  aria-label={`Delete risk for ${risk.productName}`}
                >
                  <DeleteIcon />
                </button>
              )}
            </div>
            <textarea
              className="w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
              style={{
                borderColor: isBlocked ? 'rgba(200,32,20,0.3)' : 'rgba(212,160,23,0.3)',
                minHeight: '60px',
              }}
              value={risk.text}
              onChange={(e) => handleTextChange(risk.id, e.target.value)}
              readOnly={readOnly}
            />
          </div>
        );
      })}

      {!readOnly && (
        <button
          type="button"
          className="btn-press flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
        >
          + Add Risk
        </button>
      )}
    </div>
  );
}
