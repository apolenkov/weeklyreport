"use client";

export type ScopeValue = "own" | "product" | "lead";

interface ScopeToggleProps {
  value: ScopeValue;
  onChange: (next: ScopeValue) => void;
  allowedScopes?: readonly ScopeValue[];
}

const DEFAULT_SCOPES: readonly ScopeValue[] = [
  "own",
  "product",
  "lead",
] as const;

const LABELS: Record<ScopeValue, string> = {
  own: "Own",
  product: "Product",
  lead: "Leads",
};

// Segmented-toggle visual family parity with ViewModeToggle: touching segments
// share one neutral pill matching the lead "Toggle All" button (gray border,
// transparent inactive, foreground text) so the whole toolbar reads as one
// family (user direction 2026-06-16). The active segment fills with the neutral
// --color-muted tint instead of the brand accent. Rounding/border are
// index-aware because the segment count is variable (2 or 3, driven by
// allowedScopes) rather than the fixed two of ViewModeToggle.
const ACTIVE_CLASS = "bg-[var(--color-muted)] text-[var(--color-foreground)]";
const INACTIVE_CLASS =
  "bg-transparent text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]";

export function ScopeToggle({
  value,
  onChange,
  allowedScopes = DEFAULT_SCOPES,
}: ScopeToggleProps) {
  const lastIndex = allowedScopes.length - 1;
  return (
    <div role="radiogroup" aria-label="Slide scope" className="inline-flex">
      {allowedScopes.map((s, index) => {
        const edgeClass = [
          index === 0 ? "rounded-l-[var(--radius-pill)]" : null,
          index === lastIndex ? "rounded-r-[var(--radius-pill)]" : "border-r-0",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            onClick={() => onChange(s)}
            className={`inline-flex min-h-[var(--touch-target-min)] items-center justify-center border border-[rgba(0,0,0,0.2)] px-3 text-sm font-semibold transition-colors ${edgeClass} ${
              value === s ? ACTIVE_CLASS : INACTIVE_CLASS
            }`}
          >
            {LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
