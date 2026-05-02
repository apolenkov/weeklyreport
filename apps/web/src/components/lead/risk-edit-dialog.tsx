'use client';

import { useEffect, useState } from 'react';
import type { Product, RiskEntry } from './mock-data';

type RiskEditDialogProps = {
  readonly open: boolean;
  /** null = create mode, RiskEntry = edit mode. */
  readonly risk: RiskEntry | null;
  readonly products: readonly Product[];
  readonly onSave: (next: RiskEntry & { impact: string; mitigation: string }) => void;
  readonly onCancel: () => void;
  readonly defaultProductId?: string;
  /**
   * The mockup-aligned dialog also exposes raw `impact` and `mitigation`
   * fields. The presentation `RiskEntry` doesn't carry them, but the
   * caller (lead-form) needs to write them onto the raw section.risks
   * row, so we let the dialog produce a richer object than the read
   * model.
   */
  readonly initialImpact?: string;
  readonly initialMitigation?: string;
};

type SeverityChoice = { value: 'at-risk' | 'blocked'; label: string; bg: string; color: string; border: string };
const SEVERITY_CHOICES: readonly SeverityChoice[] = [
  { value: 'at-risk', label: '! At Risk', bg: '#fef3c7',     color: '#8a6d1b',                  border: '#d4a017' },
  { value: 'blocked', label: '✕ Blocked', bg: '#fee2e2',     color: 'var(--color-destructive)', border: 'var(--color-destructive)' },
];

export function RiskEditDialog({
  open,
  risk,
  products,
  onSave,
  onCancel,
  defaultProductId,
  initialImpact,
  initialMitigation,
}: RiskEditDialogProps) {
  const isCreate = risk === null;
  const seedProduct = isCreate
    ? (products.find((p) => p.id === defaultProductId) ?? products[0])
    : products.find((p) => p.id === risk.productId);

  const [text, setText] = useState(risk?.text ?? '');
  const [severity, setSeverity] = useState<'at-risk' | 'blocked'>(risk?.severity ?? 'at-risk');
  const [productId, setProductId] = useState(risk?.productId ?? seedProduct?.id ?? '');
  const [impact, setImpact] = useState(initialImpact ?? '');
  const [mitigation, setMitigation] = useState(initialMitigation ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText(risk?.text ?? '');
      setSeverity(risk?.severity ?? 'at-risk');
      setProductId(risk?.productId ?? seedProduct?.id ?? '');
      setImpact(initialImpact ?? '');
      setMitigation(initialMitigation ?? '');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key fields, not full object
  }, [open, risk?.id, defaultProductId]);

  if (!open) return null;

  const headerProductName = products.find((p) => p.id === productId)?.name ?? '';
  const headerVerb = isCreate ? 'Add Risk' : 'Edit Risk';

  function handleSave() {
    const t = text.trim();
    const im = impact.trim();
    const m = mitigation.trim();
    if (t.length === 0) { setError('Risk description is required'); return; }
    if (im.length === 0) { setError('Impact is required'); return; }
    if (m.length === 0) { setError('Mitigation is required'); return; }
    const product = products.find((p) => p.id === productId) ?? products[0];
    if (!product) { setError('No product available'); return; }
    onSave({
      id: risk?.id ?? crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      stageName: risk?.stageName ?? '—',
      severity,
      text: t,
      impact: im,
      mitigation: m,
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
          {headerVerb} {headerProductName ? <span className="text-[var(--color-muted-foreground)]">— {headerProductName}</span> : null}
        </h2>

        <div className="space-y-4">
          {/* Risk description */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]" htmlFor="risk-text">
              Risk *
            </label>
            <textarea
              id="risk-text"
              autoFocus
              className="w-full resize-y rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              style={{ minHeight: '60px' }}
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null); }}
              placeholder="What is the risk?"
            />
          </div>

          {/* Impact */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]" htmlFor="risk-impact">
              Impact *
            </label>
            <textarea
              id="risk-impact"
              className="w-full resize-y rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              style={{ minHeight: '50px' }}
              value={impact}
              onChange={(e) => { setImpact(e.target.value); setError(null); }}
              placeholder="What does it block / delay / cost?"
            />
          </div>

          {/* Mitigation */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]" htmlFor="risk-mitigation">
              Mitigation *
            </label>
            <textarea
              id="risk-mitigation"
              className="w-full resize-y rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              style={{ minHeight: '50px' }}
              value={mitigation}
              onChange={(e) => { setMitigation(e.target.value); setError(null); }}
              placeholder="How are you addressing it?"
            />
          </div>

          {/* Severity chips */}
          <div>
            <span className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">Severity</span>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_CHOICES.map((c) => {
                const selected = severity === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSeverity(c.value)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition-all"
                    style={{
                      background: selected ? c.bg : 'transparent',
                      color: selected ? c.color : 'var(--color-foreground)',
                      border: `1.5px solid ${selected ? c.border : 'rgba(0,0,0,0.15)'}`,
                    }}
                    aria-pressed={selected}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product picker */}
          {products.length > 1 && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]" htmlFor="risk-product">
                Product
              </label>
              <select
                id="risk-product"
                className="w-full rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

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
            Save Risk
          </button>
        </div>
      </div>
    </div>
  );
}
