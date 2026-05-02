'use client';

import { useState } from 'react';

import { RiskEditDialog } from './risk-edit-dialog';
import type { Product, RiskEntry } from './mock-data';

type RisksSectionProps = {
  readonly risks: RiskEntry[];
  readonly readOnly?: boolean;
  /** Controlled-component callback fired with the next risks array on add/edit/delete. */
  readonly onChange?: (next: RiskEntry[]) => void;
  /** Fired when the text of a risk transitions empty -> non-empty (used by status<->risk sync). */
  readonly onRiskFilled?: (riskId: string) => void;
  /**
   * Products list — required so the edit dialog can show a project picker
   * and the empty-state can seed the first product. When absent or empty,
   * the +Add Risk button is rendered disabled with a tooltip.
   */
  readonly products?: readonly Product[];
  /**
   * Stages whose status is at-risk/blocked but have no risk row to back
   * them up. Surfaced as a warning banner above the list so the lead is
   * nudged to fill in details — silent SDLC-pipeline status without a
   * narrative is half a signal.
   */
  readonly unbackedStages?: readonly { productId: string; productName: string; stageName: string; severity: 'at-risk' | 'blocked' }[];
};

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

export function RisksSection({
  risks,
  readOnly = false,
  onChange,
  onRiskFilled,
  products,
  unbackedStages = [],
}: RisksSectionProps) {
  const [dialogState, setDialogState] = useState<
    { open: false } | { open: true; mode: 'create'; seedProductId?: string } | { open: true; mode: 'edit'; risk: RiskEntry }
  >({ open: false });

  function handleDelete(id: string) {
    if (readOnly) return;
    onChange?.(risks.filter((r) => r.id !== id));
  }

  function handleAdd() {
    if (readOnly) return;
    setDialogState({ open: true, mode: 'create', seedProductId: products?.[0]?.id });
  }

  function handleEdit(risk: RiskEntry) {
    if (readOnly) return;
    setDialogState({ open: true, mode: 'edit', risk });
  }

  function handleDialogSave(saved: RiskEntry & { impact: string; mitigation: string }) {
    if (readOnly) return;
    const wasEmpty = dialogState.open && dialogState.mode === 'edit'
      ? (dialogState.risk.text ?? '').trim().length === 0
      : true;

    if (dialogState.open && dialogState.mode === 'create') {
      onChange?.([...risks, saved]);
    } else {
      onChange?.(risks.map((r) => (r.id === saved.id ? saved : r)));
    }

    if (wasEmpty && saved.text.trim().length > 0) {
      onRiskFilled?.(saved.id);
    }
    setDialogState({ open: false });
  }

  function handleDialogCancel() {
    setDialogState({ open: false });
  }

  const hasProducts = products && products.length > 0;

  function handleAddForStage(productId: string) {
    if (readOnly) return;
    setDialogState({ open: true, mode: 'create', seedProductId: productId });
  }

  return (
    <div className="space-y-4">
      {/* Warning: at-risk/blocked stages with no narrative — the SDLC chip
          paints the column without context, leaving the head guessing.
          Render before the list so the user sees it immediately. */}
      {!readOnly && unbackedStages.length > 0 && (
        <div
          className="rounded-lg p-4"
          style={{ background: '#fffbeb', border: '1px solid rgba(212,160,23,0.35)' }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center justify-center text-base" style={{ color: '#d4a017' }}>
              ⚠
            </span>
            <span className="text-sm font-semibold" style={{ color: '#8a6d1b' }}>
              {unbackedStages.length === 1
                ? '1 stage marked at-risk/blocked but no risk filled in'
                : `${unbackedStages.length} stages marked at-risk/blocked but no risk filled in`}
            </span>
          </div>
          <ul className="space-y-1 text-xs text-[#8a6d1b]">
            {unbackedStages.map((s) => (
              <li key={`${s.productId}::${s.stageName}`} className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: s.severity === 'blocked' ? '#fee2e2' : '#fef3c7',
                        color: s.severity === 'blocked' ? 'var(--color-destructive)' : '#8a6d1b',
                      }}
                >
                  {s.severity === 'blocked' ? '✕ Blocked' : '! At Risk'}
                </span>
                <span className="font-medium">{s.productName}</span>
                <span>·</span>
                <span>{s.stageName}</span>
                <button
                  type="button"
                  onClick={() => handleAddForStage(s.productId)}
                  className="ml-auto inline-flex min-h-[26px] items-center rounded-[var(--radius-pill)] border border-[rgba(212,160,23,0.4)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#8a6d1b] transition-colors hover:bg-[#fffbeb]"
                  aria-label={`Add risk for ${s.productName} ${s.stageName}`}
                >
                  + Add Risk
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {risks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[#f8f6f2] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {readOnly ? 'No risks reported.' : 'No risks reported. Use “+ Add Risk” when you spot one.'}
        </div>
      ) : (
        risks.map((risk) => {
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
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: isBlocked ? '#fee2e2' : '#fef3c7',
                    color: isBlocked ? 'var(--color-destructive)' : '#8a6d1b',
                  }}
                >
                  {isBlocked ? 'Blocked' : 'At Risk'}
                </span>
                <span className="font-[family-name:var(--font-sans)] text-sm font-semibold break-words">
                  {risk.productName}
                </span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  &middot; {risk.stageName} stage
                </span>
                {!readOnly && (
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)]"
                      onClick={() => handleEdit(risk)}
                      aria-label={`Edit risk for ${risk.productName}`}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
                      onClick={() => handleDelete(risk.id)}
                      aria-label={`Delete risk for ${risk.productName}`}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                )}
              </div>
              {/* Risk + impact + mitigation summary — read-only on the
                  card; the dialog is the only edit surface so we can
                  validate all three fields together. */}
              <div className="space-y-2 text-sm text-[var(--color-foreground)]">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">Risk</span>
                  <div className="mt-0.5 break-words">{risk.text || <em className="text-[var(--color-muted-foreground)]">— pending</em>}</div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">Impact</span>
                    <div className="mt-0.5 break-words text-[var(--color-muted-foreground)]">{risk.impact || '—'}</div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">Mitigation</span>
                    <div className="mt-0.5 break-words text-[var(--color-muted-foreground)]">{risk.mitigation || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {!readOnly && (
        <button
          type="button"
          className="btn-press flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleAdd}
          disabled={!hasProducts}
          title={hasProducts ? undefined : 'No products assigned — contact admin'}
        >
          + Add Risk
        </button>
      )}

      <RiskEditDialog
        open={dialogState.open}
        risk={dialogState.open && dialogState.mode === 'edit' ? dialogState.risk : null}
        products={products ?? []}
        defaultProductId={dialogState.open && dialogState.mode === 'create' ? dialogState.seedProductId : undefined}
        initialImpact={dialogState.open && dialogState.mode === 'edit' ? dialogState.risk.impact : ''}
        initialMitigation={dialogState.open && dialogState.mode === 'edit' ? dialogState.risk.mitigation : ''}
        onSave={handleDialogSave}
        onCancel={handleDialogCancel}
      />
    </div>
  );
}
